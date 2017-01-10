import ENV from 'overhaul/config/environment';
import Route from 'ember-route';
import get from 'ember-metal/get';
import service from 'ember-service/inject';
import { retryFromServer } from 'overhaul/lib/compat-hooks';
import { beforeTeardown } from 'overhaul/lib/compat-hooks';
import PlayParamMixin from 'overhaul/mixins/play-param';

export default Route.extend(PlayParamMixin, {
  queryParams: {
    q: {
      refreshModel: true
    }
  },

  metrics: service(),

  titleToken(model) {
    return get(model, 'title');
  },
  title(tokens) {
    if (tokens && tokens.length > 0) {
      return tokens[0];
    } else {
      return 'WNYC | New York Public Radio, Podcasts, Live Streaming Radio, News';
    }
  },

  model({ upstream_url }, { queryParams }) {
    // This adds trailing slashes, because the server's redirect
    // doesn't otherwise work correctly due to the proxying I'm using
    // in development (which is neeeded due to CORs).
    upstream_url = upstream_url.replace(/\/*$/, '/');

    let qp = Object.keys(queryParams)
      .filter(q => ENV.QP_WHITELIST.includes(q)).map(p => `${p}=${queryParams[p].replace(/\s/g, '%20')}`);
    if (qp.length) {
      upstream_url += `?${qp.join('&')}`;
    }
    return this.store.find('django-page', upstream_url)
      .catch(e => retryFromServer(e, upstream_url));
  },

  afterModel(page) {
    let metrics = get(this, 'metrics');
    let path = document.location.pathname; // e.g. '/shows/bl/'
    let title = (get(page, 'title') || '').trim();
    metrics.trackPage('NprAnalytics', {
      page: path,
      title
    });
  },

  actions: {
    willTransition() {
      this._super(...arguments);
      beforeTeardown();
      return true;
    }
  }
});
