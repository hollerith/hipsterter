/*
 * Player
 * - the central data object of the game
 * - anything that is to be persisted must be attached to the Player
 */

import _ from "underscore";
import util from "util";
import config from "config";
import Enums from "./Enums";
import Board from "game/Board";
import Worker from "game/Worker";
import Company from "game/Company";

import news from "data/news.json";
import perks from "data/perks.json";
import emails from "data/emails.json";
import workers from "data/workers.json";
import locations from "data/locations.json";
import competitors from "data/competitors.json";
import technologies from "data/technologies.json";
import productTypes from "data/productTypes.json";
import onboarding from "data/onboarding.json";
import challenges from "data/challenges.json";

const lockedLocations = [
  "Seasteading State",
  "New Antarctic Colonies",
  "Gliese 832c",
  "Mars Colony"
];

const lockedTechnologies = ["Closed Ecologies", "Alcubierre Drive"];

class Player {
  constructor(data, companyData) {
    var data = data || {}, companyData = companyData || {};
    this.company = new Company(companyData, this);
    _.extend(
      this,
      {
        unlocked: {
          locations: _.chain(locations)
            .filter(l => !_.contains(lockedLocations, l.name))
            .pluck("name")
            .value(),
          technologies: _.chain(technologies)
            .filter(t => !_.contains(lockedTechnologies, t.name))
            .pluck("name")
            .value(),
          specialProjects: [],
          productTypes: [
            "Sharing",
            "Genetics",
            "Ad",
            "Entertainment",
            "Mobile",
            "Celebrity",
            "Social Network",
            "Credit",
            "E-Commerce",
            "Defense",
            "Logistics",
            "Gadget"
          ]
        },

        specialEffects: {
          Immortal: false,
          Cloneable: false,
          Prescient: false,
          "Worker Insight": false,
          "Worker Quant": false,
          "The Founder AI": false,
          Automation: false
        },

        month: 0,
        week: 0,
        year: 0,

        age: 25,
        startYear: 2001,
        died: false, // or "should have died"
        endYear: 2017, // when you die

        spendingMultiplier: 1,
        wageMultiplier: 1,
        forgettingRate: 1,
        economicStability: 1,
        taxRate: 1,
        expansionCostMultiplier: 1,
        researchCostMultiplier: 1,
        costMultiplier: 1,
        economy: Enums.Economy.Neutral,
        nextEconomy: Enums.Economy.Neutral,
        revenuePerMarketShareBonus: 0,

        competitors: competitors,
        workers: _.map(workers, function(w) {
          return Worker.init(w, false);
        }),

        technologies: technologies,
        perks: perks,

        // event pools
        news: news,
        emails: _.map(emails, e => {
          if (e.repeatable) {
            e.countdown = _.random(
              config.EMAIL_COUNTDOWN_MIN,
              config.EMAIL_COUNTDOWN_MAX
            );
          }
          return e;
        }),
        current: {
          news: {},

          // all emails (archive)
          emails: [],

          // new emails
          inbox: []
        },

        // board
        board: {
          profitTarget: config.STARTING_PROFIT_TARGET,
          happiness: config.BOARD_STARTING_HAPPINESS
        },

        onboarding: onboarding,
        challenges: _.map(challenges, c =>
          _.extend(
            {
              finished: false
            },
            c
          )),

        seenMarket: false
      },
      data
    );
  }

  get snapshot() {
    var company = this.company;
    return {
      name: company.name,
      week: this.week,
      month: this.month,
      year: this.startYear + this.year,
      cash: company.cash,
      companyAge: this.year,
      profitTargetProgress: company.annualProfit / this.board.profitTarget,
      profitTargetProgressPercent: company.annualProfit /
        this.board.profitTarget *
        100,
      profitTarget: this.board.profitTarget,
      boardStatus: Board.mood(this.board),
      design: company.skill("design", false, false, false, true),
      marketing: company.skill("marketing", false, false, false, true),
      engineering: company.skill("engineering", false, false, false, true),
      productivity: company.skill("productivity", false, false, false, true),
      happiness: company.skill("happiness", false, false, false, true),
      hype: company.hype,
      outrage: company.outrage,
      cofounder: company.cofounder,
      employees: company.workers.length,
      salaries: company.salaries,
      rent: company.rent,
      expenditures: company.expenditures,
      taxes: company.taxes,
      n_locations: company.locations.length,
      locations: company.locations,
      globalCoverage: (company.locations.length /
        locations.length *
        100).toFixed(2),
      n_technologies: company.technologies.length,
      technologies: company.technologies,
      ytdCosts: company.annualCosts,
      ytdRevenue: company.annualRevenue,
      ytdProfit: company.annualProfit,
      revenueChange: company.annualRevenue - company.lastAnnualRevenue,
      profitChange: company.annualProfit -
        (company.lastAnnualRevenue - company.lastAnnualCosts),
      lifetimeRevenue: company.lifetimeRevenue,
      verticals: company.verticals,

      taxRate: this.taxRate * config.BASE_TAX_RATE,
      economy: util.enumName(this.economy, Enums.Economy),
      taxesAvoided: company.taxesAvoided,
      debtOwned: company.debtOwned,
      pollution: company.pollution,
      deathToll: company.deathToll,
      moralPanic: company.moralPanic,
      globalAvgWage: 7 * this.wageMultiplier,
      consumerSpending: this.spendingMultiplier * 100,
      forgettingRate: this.forgettingRate,
      wageMultiplier: this.wageMultiplier,

      hasExtraTerra: _.contains(company.markets, "Extra Terra"),
      hasAlien: _.contains(company.markets, "Alien"),

      showAnnualReport: this.year > 0,
      prevYear: this.startYear + this.year - 1,
      lastProfit: company.lastAnnualRevenue - company.lastAnnualCosts,
      lastRevenue: company.lastAnnualRevenue,
      lastCosts: company.lastAnnualCosts,
      growth: this.growth,
      boardStatus: Board.mood(this.board),

      news: this.current.news,
      emails: this.current.emails,
      inbox: this.current.inbox,

      product: company.product,
      activeProducts: company.activeProducts,
      promo: company.promo,

      onboarding: _.reduce(
        this.onboarding,
        function(obj, v) {
          obj[v.name] = v.finished;
          return obj;
        },
        {}
      )
    };
  }

  skipOnboarding() {
    this.onboarding = _.each(this.onboarding, function(v, k) {
      onboarding[k].finished = true;
    });
    this.seenMarket = true;
  }
}

export default Player;
