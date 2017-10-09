import $ from 'jquery';
import _ from 'underscore';
import util from 'util';
import Popup from 'views/Popup';
import Manager from 'app/Manager';
import Confirm from 'views/alerts/Confirm';

const N_PRODUCTS = 10;

const template = data => `
<div class="accounting-body">
  <div class="accounting-costs">
    <h3>Cost Breakdown</h3>
    <table>
      <tr>
        <td>Rent</td>
        <td>${util.formatCurrency(data.rent)}</td>
      </tr>
      <tr>
        <td>Salaries</td>
        <td>${util.formatCurrency(data.salaries)}</td>
      </tr>
      <tr>
        <td>Monthly Total</td>
        <td>${util.formatCurrency(data.salaries + data.rent)}/month</td>
      </tr>
    </table>
    <table>
      <tr>
        <td>Other Expenditures This Year</td>
        <td>${util.formatCurrency(data.expenditures)}</td>
      </tr>
      <tr>
        <td>Expected Taxes This Year</td>
        <td>${util.formatCurrency(data.taxes)}</td>
      </tr>
    </table>
    <table>
      <tr>
        <td>YTD Costs</td>
        <td>${util.formatCurrency(data.ytdCosts)}</td>
      </tr>
    </table>
  </div>
  <div class="accounting-income">
    <h3>Revenue Streams</h3>
    <table class="accounting-products">
    </table>
    <table>
      <tr>
        <td>YTD Revenue</td>
        <td>${util.formatCurrency(data.ytdRevenue)}</td>
      </tr>
    </table>
  </div>
</div>
`;

function productRevenues(products) {
  return products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${util.formatCurrency(p.earnedRevenue)}</td>
    </tr>
  `).join('');
}


class View extends Popup {
  constructor(player) {
    super({
      title: 'Accounting',
      template: template
    });
    this.player = player;
    var products = player.company.activeProducts.slice(0, N_PRODUCTS),
        archivedProducts = player.company.products.concat().reverse().slice(0, N_PRODUCTS - products.length);
    this.products = products.concat(archivedProducts);
  }

  render() {
    var player = this.player;
    super.render(player.snapshot);
    this.el.find('.accounting-products').html(productRevenues(this.products));
  }

  update() {
    this.el.find('.accounting-products').html(productRevenues(this.products));
  }
}

export default View;

