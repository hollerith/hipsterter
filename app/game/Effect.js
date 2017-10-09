/*
 * Effect
 * - applies or removes effects to the player & company
 * - provides a string representation of an effect
 */

import _ from 'underscore';
import util from 'util';

const Effect = {
  apply: function(effect, player) {
    this[effect.type](player, effect.value, false);
  },
  applies: function(effects, player) {
    var self = this;
    _.each(effects, function(effect) {
      self.apply(effect, player);
    });
  },
  remove: function(effect, player) {
    this[effect.type](player, effect.value, true);
  },
  removes: function(effects, player) {
    var self = this;
    _.each(effects, function(effect) {
      self.remove(effect, player);
    });
  },

  cash: function(player, value, remove) {
    player.company.cash += remove ? -value : value;
  },
  forgettingRate: function(player, value, remove) {
    player.forgettingRate += remove ? -value : value;
  },
  spendingMultiplier: function(player, value, remove) {
    player.spendingMultiplier += remove ? -value : value;
  },
  wageMultiplier: function(player, value, remove) {
    player.wageMultiplier += remove ? -value : value;
  },
  economicStability: function(player, value, remove) {
    player.economicStability += remove ? -value : value;
  },
  taxRate: function(player, value, remove) {
    player.taxRate += remove ? -value : value;
  },
  expansionCostMultiplier: function(player, value, remove) {
    player.expansionCostMultiplier += remove ? -value : value;
  },
  costMultiplier: function(player, value, remove) {
    player.costMultiplier += remove ? -value : value;
  },
  productivity: function(player, value, remove) {
    player.company.workerBonuses.productivity += remove ? -value : value;
  },
  happiness: function(player, value, remove) {
    player.company.workerBonuses.happiness += remove ? -value : value;
  },
  design: function(player, value, remove) {
    player.company.workerBonuses.design += remove ? -value : value;
  },
  engineering: function(player, value, remove) {
    player.company.workerBonuses.engineering += remove ? -value : value;
  },
  marketing: function(player, value, remove) {
    player.company.workerBonuses.marketing += remove ? -value : value;
  },
  outrage: function(player, value, remove) {
    player.company.outrage += remove ? -value : value;
  },
  researchCostMultiplier: function(player, value, remove) {
    player.researchCostMultiplier += remove ? -value : value;
  },
  revenuePerMarketShare: function(player, value, remove) {
    player.revenuePerMarketShareBonus += remove ? -value : value;
  },
  product: function(player, value, remove) {
    var bonuses = player.company.productBonuses,
        vertical = value.vertical,
        attribute = value.attribute;
    if (!remove) {
      if (!(vertical in bonuses)) {
        bonuses[vertical] = {};
      }
      if (!(attribute in bonuses[vertical])) {
        bonuses[vertical][attribute] = value.value;
      } else {
        bonuses[vertical][attribute] += value.value;
      }
    } else {
      bonuses[vertical][attribute] -= value.value;
    }
  },
  specialEffect: function(player, value, remove) {
    player.specialEffects[value] = !remove;
  },
  unlocks: function(player, value, remove) {
    if (!remove) {
      player.unlocked[value.type].push(value.value);
    } else {
      player.unlocked[value.type] = _.difference(player.unlocked[value.type], [value.value]);
    }
  },

  toString: function(effect) {
    if (_.isNumber(effect.value)) {
      var valueStr = effect.value > 0 ? '+' + effect.value : effect.value;
      switch (effect.type) {
        case 'forgettingRate':
          return valueStr + ' to consumer distractedness';
        case 'spendingMultiplier':
          return valueStr + 'x to consumer spending';
        case 'wageMultiplier':
          return valueStr + 'x to global worker wages';
        case 'economicStability':
          return valueStr + ' to economic stability';
        case 'taxRate':
          return valueStr + 'x to your tax rate';
        case 'expansionCostMultiplier':
          return valueStr + 'x to expansion costs';
        case 'researchCostMultiplier':
          return valueStr + 'x to research costs';
        case 'costMultiplier':
          return valueStr + 'x to all costs';
        case 'productivity':
          return valueStr + ' to employee productivity';
        case 'happiness':
          return valueStr + ' to employee satisfaction';
        case 'design':
          return valueStr + ' to employee design skills';
        case 'engineering':
          return valueStr + ' to employee engineering skills';
        case 'marketing':
          return valueStr + ' to employee marketing skills';
        case 'outrage':
          return valueStr + ' outrage';
        case 'cash':
          return valueStr + ' cash';
        case 'revenuePerMarketShare':
          return valueStr + ' revenue per market share';
      }
    } else if (_.isString(effect.value)) {
      switch (effect.type) {
        case 'specialEffect':
          switch (effect.value) {
            case 'Immortal':
              return 'You become immortal';
            case 'Cloneable':
              return 'Allows you to clone your best employees';
            case 'Prescient':
              return 'Predicts shifts in the economy';
            case 'Worker Insight':
              return 'Learn about the personalities of prospective employees via social media';
            case 'Worker Quant':
              return 'Quantifies minutiae of prospective employees';
            case 'Automation':
              return 'Allows you to purchase robotic employees';
            case 'The Founder AI':
              return 'You win the game';
          }
      }
    } else if (_.isObject(effect.value)) {
      switch (effect.type) {
        case 'product':
          var value = effect.value.value,
              valueVal = effect.value.attribute === 'development time' ? `${value}x` : value,
              valueStr = value > 0 ? '+' + valueVal : valueVal;
          return valueStr + ' to ' + effect.value.vertical + ' products\' ' + effect.value.attribute;
        case 'unlocks':
          var type;
          switch (effect.value.type) {
              case 'locations':
                type = 'location';
                break;
              case 'technologies':
                type = 'research';
                break;
              case 'productTypes':
                type = 'product type';
                break;
              case 'specialProjects':
                type = 'special project';
                break;
          }
          return `Unlocks the "${effect.value.value}" ${type}`;
      }
    }
  }
};

export default Effect;
