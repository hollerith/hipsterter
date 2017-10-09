import _ from 'underscore';
import util from 'util';
import CardsList from 'views/CardsList';
import verticals from 'data/verticals.json';


function button(item) {
  if (item.owned) {
    return '<button disabled class="owned">Owned</button>';
  } else if (item.afford) {
    return '<button class="buy">Expand to this vertical</button>';
  } else {
    return '<button disabled>Not enough cash</button>';
  }
}

const detailTemplate = item => `
  <div class="title">
    <h1>${item.name}</h1>
    <h4 class="cash">${util.formatCurrencyAbbrev(item.cost)}</h4>
  </div>
  <img src="assets/verticals/${util.slugify(item.name)}.gif">
  <p>${item.description}</p>
  ${button(item)}
`

class View extends CardsList {
  constructor(player) {
    super({
      title: 'Verticals',
      detailTemplate: detailTemplate,
      handlers: {
        '.buy': function(ev) {
          var idx = this.itemIndex(ev.target),
              sel = verticals[idx];
          player.company.buyVertical(sel);
          this.subviews[idx].render(this.processItem(this.items[idx]));
        }
      }
    });
    this.player = player;
  }

  render() {
    this.items = _.map(verticals, v => {
      var item = this.processItem(v);
      item.cost *= this.player.costMultiplier;
      return item;
    });
    super.render({
      items: this.items
    });

    // hacky
    this.el.find('header').append('<div class="popup-description">Verticals expand your purchaseable product types and the technologies you can research.</div>');
  }

  update() {
    var self = this;
    _.each(_.zip(this.items, this.subviews), function(v, i) {
      var item = self.processItem(v[0]);
      if (!_.isEqual(v[0], item)) {
        self.items[i] = item;
        v[1].el.find('button').replaceWith(button(item));
      }
    });

    this.el.find('.current-cash-value').text(
      `Cash: ${util.formatCurrency(this.player.company.cash)}`
    );
  }

  processItem(item) {
    var player = this.player,
        item = _.clone(item);
    return _.extend(item, {
      owned: util.contains(player.company.verticals, item),
      afford: player.company.cash >= item.cost
    });
  }
}

export default View;
