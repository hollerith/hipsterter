/*
 * Board
 * - the interactive/visualized layer on top of the grid
 * - manages tile placement
 * - manages tile interaction
 * - manages tile visualization
 * - manages piece movement
 * - board size is a function of player company locations and markets
 */

import _ from 'underscore';
import Grid from './Grid';
import Tile from './Tile';
import Position from './Position';

const rows = 9;
const cols = 14;
const tileWidth = 104;
const tileHeight = 88;
const selectedHighlightColor = 0xF1FA89;
const selectedMoveHighlightColor = 0xca14ab;
const humanMoveHighlightColor = 0xff6cf9;
const enemyMoveHighlightColor = 0xFA6B6B;

function euclideanDistance(a, b) {
  return Math.sqrt(Math.pow((a.x - b.x),2) + Math.pow((a.y - b.y),2));
}

function nTiles(company) {
  return 24 + company.locations.length + 3 * company.markets.length;
}

class Board {
  constructor(company, players, game) {
    var self = this;
    var n_tiles = nTiles(company);
    this.cols = cols;
    this.rows = rows;
    this.game = game;

    this.selectedTile = null;
    this.validMoves = [];
    this.tileTweens = [];
    Tile.onSingleClick.add(this.onSingleClickTile, this);
    Tile.onDoubleClick.add(this.onDoubleClickTile, this);

    // can't have more tiles than spaces in the grid
    n_tiles = Math.min(cols * rows, n_tiles);

    this.grid = new Grid(rows, cols);
    this.setupTiles(n_tiles, rows, cols, company.player);
    this.setupPlayers(players);
    this.centerMap();

    this.humanPlayer = _.find(players, p => p.human);

    //this.debug();
  }

  setupTiles(n_tiles, rows, cols, player) {
    // generate the board
    this.center = new Position(Math.round(rows/2), Math.round(cols/2));
    this.tileGroup = this.game.add.group();
    var tilePositions = [this.center],
        tile = player.seenMarket ? Tile.random() : new Tile.Income();
    this.placeTileAt(tile, this.center);

    while (tilePositions.length < n_tiles) {
      var pos = _.chain(tilePositions)
        .map(p => this.grid.adjacentNoTilePositions(p))
        .flatten().sample().value();
      this.placeTileAt(player.seenMarket ? Tile.random() : new Tile.Income(), pos);
      tilePositions.push(pos);
    }
  }

  setupPlayers(players) {
    // place HQs
    // place first player at random location
    var self = this;
    var startingPositions = [
      _.sample(this.grid.tilePositions)
    ];

    // place other players as far as possible from other players
    _.each(_.rest(players), function(player) {
      var bestScore = 0,
          bestPos = self.center;

      // not efficient, but fine for here
      _.each(self.grid.tilePositions, function(pos) {
        var score = _.reduce(startingPositions, function(mem, spos) {
          // manhattan distance
          return Math.abs(pos.col - spos.col) + Math.abs(pos.row - spos.row);
        }, 0);
        if (score > bestScore) {
          bestScore = score;
          bestPos = pos;
        }
      });
      startingPositions.push(bestPos);
    });

    // place pieces at starting positions
    for (var i=0; i < startingPositions.length; i++) {
      this.placePieceAt(players[i].pieces[0], startingPositions[i]);
    }

    // randomly distribute remaining player pieces
    // nearby their starting positions
    _.each(players, function(player) {
      _.each(_.rest(player.pieces), function(p) {
        // get a random unoccupied position adjacent to an already-placed piece
        var pos = _.chain(player.pieces)
          .filter(p => p.position)
          .map(p => self.grid.adjacentUnoccupiedTilePositions(p.position))
          .flatten().sample().value();
        self.placePieceAt(p, pos);
      });
    });
  }

  centerMap() {
    // center the map
    var minRow = this.rows,
        maxRow = 0,
        minCol = this.cols,
        maxCol = 0;
    _.each(this.grid.tilePositions, function(pos) {
      if (pos.row > maxRow) {
        maxRow = pos.row;
      } else if (pos.row < minRow) {
        minRow = pos.row;
      }
      if (pos.col > maxCol) {
        maxCol = pos.col;
      } else if (pos.col < minCol) {
        minCol = pos.col;
      }
    });
    var maxs = this.coordinateForPosition(new Position(maxRow, maxCol)),
        mins = this.coordinateForPosition(new Position(minRow, minCol)),
        offsetX = this.game.world.centerX - (mins.x + (maxs.x - mins.x)/2),
        offsetY = this.game.world.centerY - (mins.y + (maxs.y - mins.y)/2);

    // shift by tileWidth to make space on the left for the UI
    this.tileGroup.x = offsetX + tileWidth;
    this.tileGroup.y = offsetY - tileHeight/2;
  }

  placeTileAt(tile, pos) {
    var coord = this.coordinateForPosition(pos);
    tile.render(coord, this.tileGroup, this.game, tileHeight);
    this.grid.setTileAt(pos, tile);
    tile.position = pos;
  }

  debug() {
    var self = this;
    _.each(this.grid.tiles, function(t) {
      var pos = t.position,
          coord = self.coordinateForPosition(pos),
          text = self.game.add.text(coord.x, coord.y, pos.row.toString() + "," + pos.col.toString());
      self.tileGroup.add(text);
    });
  }

  checkHumanDone() {
    var noMoves = _.every(this.humanPlayer.pieces, p => p.moves === 0);
    var noPieces = this.humanPlayer.pieces.length === 0;
    if (_.isFunction(this.onHumanDone) && (noMoves || noPieces)) {
      this.onHumanDone();
    }
  }

  movePieceTowards(piece, toTile, cb) {
    var self = this,
        from = piece.position,
        cb = cb || _.noop;

    var predicate = function(tile) {
      var unoccupied = !tile.piece,
          friendly = tile.piece && tile.piece.owner == piece.owner;
      return unoccupied || friendly;
    }
    var path = this.grid.findLegalPath(piece, toTile, predicate.bind(this));

    if (path && path.length > 0) {
      piece.moves -= path.length;
      this.grid.tileAt(from).piece = null;
      this.animatePieceAlongPath(piece, path, _.last(path), cb);
    } else {
      cb();
    }
  }

  animatePieceAlongPath(piece, path, target, cb) {
    var self = this,
        cb = cb || _.noop;

    // animate piece to tile
    var tween;
    while (path.length > 0) {
      var pos = path.shift(),
          coord = this.coordinateForPosition(pos),
          tween_ = this.game.add.tween(piece.sprite).to(coord, 200, Phaser.Easing.Quadratic.InOut, true);
      if (!tween) {
        tween = tween_;
      } else {
        tween = tween.chain(tween_);
      }
    }
    tween.onComplete.add(function() {
      self.placePieceAt(piece, target);
      cb();
    }, this);
    tween.start();
  }

  placePieceAt(piece, pos) {
    var tile = this.grid.tileAt(pos),
        coord = this.coordinateForPosition(pos);
    piece.position = pos;
    piece.tile = tile;
    piece.render(coord, this.tileGroup, this.game, tileHeight, tileWidth, this);
    tile.piece = piece;
  }

  coordinateForPosition(pos) {
    // hexagon row shift
    var shift = ((pos.row%2) * tileWidth/2),
        x = this.game.world.centerX + ((pos.col - this.center.col) * tileWidth) + shift,
        y = this.game.world.centerY + ((pos.row - this.center.row) * tileHeight);
    return {x: x, y: y};
  }

  onSingleClickTile(tile) {
    var self = this;
    this.unhighlightTiles();
    this.validMoves = [];

    // highlight selected tile
    this.selectedTile = tile;
    this.selectedTile.sprite.tint = selectedHighlightColor;

    // highlight valid movement tiles
    if (tile.piece) {
      this.validMoves = this.grid.validMovePositions(tile, tile.piece.moves);

      // only highlight for enemy pieces
      if (!tile.piece.owner.human) {
        tile.sprite.tint = tile.piece.owner.human ? humanMoveHighlightColor : enemyMoveHighlightColor;
        _.each(this.validMoves, function(pos) {
          var t = self.grid.tileAt(pos), color;
          if(tile.piece.owner.human) {
            color = (!t.piece || t.piece.owner.human) ? humanMoveHighlightColor : enemyMoveHighlightColor;
          } else {
            color = enemyMoveHighlightColor;
          }
          t.sprite.tint = color;
        });
      }
    }
  }

  onDoubleClickTile(tile) {
    var self = this;
    this.selectedTile = tile;
    var selectedPieceIsValid = this.selectedTile
      && this.selectedTile.piece
      && this.selectedTile.piece.owner.human
      && this.selectedTile.piece.moves > 0;
    if (selectedPieceIsValid) {
      if (_.isFunction(tile.capture) && tile.piece == this.selectedTile.piece && tile.piece.product && tile.piece.moves > 0) {
        tile.capture(tile.piece);
        this.checkHumanDone();
      }
    }
    this.selectedTile = null;
    this.unhighlightTiles();
  }

  onDragStartPiece(piece, pointer) {
    var self = this,
        tile = piece.tile;

    if (!tile.piece) {
      return;
    }

    this.game.canvas.style.cursor = "-webkit-grabbing";

    // hack to click the tile underneath
    tile.onClick();

    // pulsate possible moves
    this.validMoves = this.grid.validMovePositions(tile, tile.piece.moves);
    _.each(this.validMoves, function(pos) {
      var t = self.grid.tileAt(pos),
          startTint = t.sprite.tint,
          blend = {step: 0},
          colorTween = self.game.add.tween(blend).to({ step: 100 }, 500).yoyo(true).loop(true);
      t.sprite.targetTint = humanMoveHighlightColor;
      colorTween.onUpdateCallback(() => {
          t.sprite.tint = Phaser.Color.interpolateColor(startTint, t.sprite.targetTint, 100, blend.step);
      });
      colorTween.start();
      self.tileTweens.push(colorTween);
    });

    this._onDragStart();
  }

  onDragUpdatePiece(piece, pointer) {
    // reset tween highlights of all tiles
    _.each(this.grid.tiles, t => {
      t.sprite.targetTint = humanMoveHighlightColor;
    });

    // change highlight for closest candidate
    var tile = this.nearestTileToCoordinate({
      x: piece.sprite.x,
      y: piece.sprite.y
    });
    if (tile) {
      tile.sprite.targetTint = selectedMoveHighlightColor;
    }

    // not sure exactly how this happens,
    // but sometimes the position becomes nan
    // as a stopgap, reset to the tile's old position
    // and stop drag
    if (isNaN(piece.sprite.position.x) || isNaN(piece.sprite.position.y)) {
      var coord = this.coordinateForPosition(piece.tile.position);
      piece.sprite.position.x = coord.x;
      piece.sprite.position.y = coord.y;
      this.onDragStopPiece(piece, pointer);
    }
  }

  onDragStopPiece(piece, pointer) {
    _.each(this.tileTweens, t => t.stop());
    this.tileTweens = [];
    this.unhighlightTiles();
    this.game.canvas.style.cursor = "default";

    var nearestTile = this.nearestTileToCoordinate({
      x: piece.sprite.x,
      y: piece.sprite.y
    });
    if (!nearestTile || nearestTile == piece.tile || !_.any(this.validMoves, p => _.isEqual(p, nearestTile.position))) {
      var coord = this.coordinateForPosition(piece.tile.position),
          tween = this.game.add.tween(piece.sprite).to(coord, 200, Phaser.Easing.Quadratic.InOut, true);
      tween.start();
    } else {
      var attacker = piece,
          defender = nearestTile.piece;
      if (defender && attacker.owner != defender.owner) {
        if (_.contains(this.grid.tilesInRange(attacker.tile.position, 1), nearestTile)) {
            this.attackPiece(attacker, defender);
            this.checkHumanDone();
        } else {
          this.movePieceTowards(piece, nearestTile, () => {
            var coord = this.coordinateForPosition(piece.tile.position),
                tween = this.game.add.tween(piece.sprite).to(coord, 200, Phaser.Easing.Quadratic.InOut, true);
            tween.start();

            // check we're actually close enough to attack
            if (attacker.moves > 0 && _.contains(this.grid.tilesInRange(attacker.tile.position, 1), nearestTile)) {
              this.attackPiece(attacker, defender);
            }
            this.checkHumanDone();
          });
        }
      } else {
        this.movePieceTowards(piece, nearestTile, this.checkHumanDone.bind(this));
      }
    }
  }

  nearestTileToCoordinate(coord) {
    var self = this;
    var tgrp = _.chain(this.grid.tiles).map(t => {
      var coord_ = self.coordinateForPosition(t.position);
      return {
        tile: t,
        dist: euclideanDistance(coord, coord_)
      }
    }).filter(t => {
      return t.dist <= tileWidth;
    }).min(t => {
      return t.dist;
    }).value();

    if (tgrp) {
      return tgrp.tile;
    }
  }

  attackPiece(attacker, defender) {
    var dmgReport = attacker.attack(defender);

    // move to the defender spot if they were destroyed
    if (defender.health <= 0 && attacker.health > 0) {
      this.grid.tileAt(attacker.position).piece = null;
      this.animatePieceAlongPath(attacker, [defender.position], defender.position);
    } else {
      this.animatePieceAlongPath(attacker, [attacker.position], attacker.position);
    }

    this.onCombat({
      destroyed: {
        defender: defender.health <= 0,
        attacker: attacker.health <= 0
      },
      damageTaken: {
        defender: dmgReport.attacker,
        attacker: dmgReport.defender
      },
      tiles: {
        defender: defender.tile,
        attacker: attacker.tile
      }
    });
  }

  unhighlightTiles() {
    _.each(this.grid.tiles, t => t.resetColor());
  }

  get incomeTiles() {
    return _.filter(this.grid.tiles, t => t instanceof Tile.Income);
  }

  get influencerTiles() {
    return _.filter(this.grid.tiles, t => t instanceof Tile.Influencer);
  }

  get uncapturedTiles() {
    return _.filter(this.grid.tiles, t => (t instanceof Tile.Income) && !(t.owner));
  }
}

Board.nTiles = nTiles;
export default Board;
