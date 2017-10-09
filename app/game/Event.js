/*
 * Event
 * - only occur when conditions are satisfied
 * - emails
 *   - may have effects
 *   - may have an associated task
 *   - may be repeatable, scheduled to repeat at some random time later
 * - news
 *   - may be repeatable
 *   - if not enough "real" news is available, filler news is provided
 */

import doT from 'dot';
import _ from 'underscore';
import util from 'util';
import config from 'config';
import Effect from './Effect';
import Condition from './Condition';
import fillerNews from 'data/newsFiller.json';
import journalists from 'data/journalists.json';

const MIN_NEWS_ARTICLES = 9;
const FILLER_IMAGES = _.map(_.range(15), i => `assets/news/filler/${i}.jpg`);

function template(obj, keys, player) {
  var result = _.clone(obj),
      data = _.extend({
        cofounderSlug: util.slugify(player.company.cofounder.name),
        companySlug: util.slugify(player.company.name),
        taxesAvoided: util.formatCurrencyAbbrev(player.company.taxesAvoided),
        debtOwned: util.formatCurrencyAbbrev(player.company.debtOwned),
        moralPanic: player.company.moralPanic,
        competitor: _.sample(player.competitors),
        globalAvgWage: util.formatCurrency(player.snapshot.globalAvgWage),
        consumerSpending: player.snapshot.consumerSpending
      }, player);
  _.each(keys, function(k) {
    result[k] = doT.template(obj[k])(data);
  });
  result.author = _.sample(Event.journalists);
  return result;
}

const Event = {
  journalists: journalists,

  satisfied: function(event, player) {
    return _.every(event.conditions, function(condition) {
      return Condition.satisfied(condition, player);
    });
  },

  formatEmail: function(email, player) {
    var result = template(email, ['subject', 'from', 'body'], player);
    delete result.author;
    return result;
  },

  updateEmails: function(player) {
    var emails = _.filter(player.emails, function(email) {
      var satisfied = Event.satisfied(email, player);
      if (email.repeatable) {
        if (satisfied) {
          email.countdown = Math.max(0, email.countdown - 1);
        }
        return satisfied && email.countdown <= 0 && Math.random() <= config.EMAIL_REPEAT_PROB;
      } else {
        return satisfied;
      }
    });

    // apply email effects
    _.each(emails, function(email) {
      if (email.effects) {
        Effect.applies(email.effects, player);
      }
      if (email.repeatable) {
        email.countdown = _.random(config.EMAIL_COUNTDOWN_MIN, config.EMAIL_COUNTDOWN_MAX);

        // too hard for some people. longer delay
        if (email.subject === 'Patent lawsuit') {
          email.countdown *= 2;
        }
      }
    });

    // some emails are non-repeatable
    player.emails = _.difference(
      player.emails,
      _.filter(emails, e => !e.repeatable));

    // apply templates
    emails = _.map(emails, e => this.formatEmail(e, player));
    player.current.inbox = player.current.inbox.concat(emails);
  },

  updateNews: function(player) {
    var specialNews = [],
        news = [],
        fillerImages = _.shuffle(_.clone(FILLER_IMAGES));

    _.each(player.news, function(n) {
      if (Event.satisfied(n, player)) {
        // if just one article, it's a special one-time event
        if (n.article) {
          specialNews.push(n);
        } else {
          news.push(n);
        }
      }
    });

    // special news is non-repeatable
    player.news = _.difference(player.news, specialNews);

    specialNews = _.pluck(specialNews, 'article');
    news = _.map(news, n => _.sample(n.articles));

    // special news take priority
    news = specialNews.concat(news);

    // apply templates
    news = _.map(news, n => template(n, ['title', 'body'], player));

    // add filler news
    if (news.length < MIN_NEWS_ARTICLES) {
      var filler = _.shuffle(fillerNews);
      _.times(MIN_NEWS_ARTICLES - news.length, function() {
        news.push(_.extend({
          author: _.sample(Event.journalists),
          image: fillerImages.pop()
        }, filler.pop()));
      });
    }
    news = news.reverse();

    player.current.news = {
      mainArticle: news.pop(),
      topArticles: _.compact([news.pop(), news.pop()]),
      articles: news
    };
  }
};

export default Event;
