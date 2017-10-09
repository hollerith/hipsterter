import $ from 'jquery'
import _ from 'underscore';
import util from 'util';
import tmpl from 'views/Common';
import View from 'views/View';
import CardsList from 'views/CardsList';
import productTypes from 'data/productTypes.json';

const difficulties = [
  'Very Easy',
  'Easy',
  'Moderate',
  'Hard',
  'Very Hard'
];

function button(item) {
  if (!item.unlocked) {
      return '<button disabled>Locked</button>';
  } else {
    if (item.owned) {
      return '<button class="owned" disabled>Owned</button>';

    // missing required vertical
    } else if (!item.available) {
      return `<button disabled>Requires ${item.requiredVertical} vertical</button>`;

    } else if (item.afford) {
      return `<button class="buy">${util.formatCurrency(item.cost)}</button>`;
    } else {
      return `<button disabled>${util.formatCurrency(item.cost)}</button>`;
    }
  }
}

function detailTemplate(item) {
  if (item.unlocked) {
    return `
      <div class="title">
        <h1>${item.name}</h1>
        ${item.owned ? `${tmpl.expertise(item)}` : ``}
        <h5 data-tip="Difficulty">${difficulties[item.difficulty-1]}</h5>
      </div>
      <img src="assets/productTypes/${util.slugify(item.name)}.gif">
      ${button(item)}`;
  } else {
    return `
      <div class="title">
        <h1>???</h1>
      </div>
      <img src="assets/placeholder.gif">
      ${button(item)}`;
  }
}

class ProductTypesView extends CardsList {
  constructor(player) {
    super({
      title: 'Product Types',
      detailTemplate: detailTemplate,
      handlers: {
        '.buy': function(ev) {
          var $el = $(ev.target),
              idx = $el.closest('li').index(),
              sel = productTypes[this.pts_idx_map[idx]];
          player.company.buyProductType(sel);
          this.subviews[idx].render(this.processItem(this.items[idx]));
        }
      }
    });
    this.player = player;
    this.sorted_pts = _.chain(productTypes).map(this.processItem.bind(this)).sortBy(this.sorter.bind(this)).value();
    this.pts_idx_map = _.chain(productTypes)
      .map(this.processItem.bind(this))
      .map((pt, i) => ({idx: i, pt: pt, owned: pt.owned, available: pt.available}))
      .sortBy(this.sorter.bind(this)).pluck('idx').value();
  }

  sorter(pt, i) {
    var idx = 2;
    if (pt.owned) {
      idx = 0;
    } else if (pt.available) {
      idx = 1;
    }
    return (idx*10000) + i;
  }

  render() {
    this.items = _.map(this.sorted_pts, pt => {
      pt.cost *= this.player.costMultiplier;
      return pt;
    });
    super.render({
      items: this.items
    });
    this.nProductTypes = this.player.company.productTypes.length;

    // hacky
    this.el.find('header').append('<div class="popup-description">Product types are combined to create products - some combos are innovative, others are not.</div>');
  }

  update() {
    this.el.find('.current-cash-value').text(
      `Cash: ${util.formatCurrency(this.player.company.cash)}`
    );
  }

  processItem(item) {
    var player = this.player,
        item = _.clone(item);
    var owned = util.contains(player.company.productTypes, item);
    if (owned) {
      item.expertise = _.findWhere(player.company.productTypes, {name: item.name}).expertise;
    }
    return _.extend(item, {
      owned: owned,
      available: player.company.productTypeIsAvailable(item),
      unlocked: _.contains(player.unlocked.productTypes, item.name),
      afford: player.company.cash >= item.cost
    });
  }

  createListItem(item) {
    return new View({
      tag: 'li',
      parent: this.el.find('ul'),
      template: this.detailTemplate,
      method: 'append',
      attrs: {
        class: item.available ? '' : 'locked'
      }
    });
  }
}

export default ProductTypesView;
