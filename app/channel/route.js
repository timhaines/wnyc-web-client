import Route from 'ember-route';
import service from 'ember-service/inject';
import Ember from 'ember';
const {
  Inflector,
  get,
  set
} = Ember;
const { hash: waitFor } = Ember.RSVP;
const inflector = new Inflector(Inflector.defaultRules);
import { retryFromServer, beforeTeardown } from 'wnyc-web-client/lib/compat-hooks';
import PlayParamMixin from 'wnyc-web-client/mixins/play-param';
import config from 'wnyc-web-client/config/environment';

export default Route.extend(PlayParamMixin, {
  session:      service(),

  model(params) {
    const channelType = this.routeName;
    const listingSlug = `${inflector.pluralize(channelType)}/${params.slug}`;
    set(this, 'listingSlug', listingSlug);

    return this.store.find('django-page', listingSlug.replace(/\/*$/, '/')).then(page => {
      return waitFor({
        page,
        channel: page.get('wnycChannel'),
        user: this.get('session.data.authenticated')
      });
    })
    .catch(e => retryFromServer(e, listingSlug.replace(/\/*$/, '/')));
  },

  afterModel({ channel }, transition) {
    if (channel.get('headerDonateChunk')) {
      transition.send('updateDonateChunk', channel.get('headerDonateChunk'));
    }
    if (channel.get('altLayout')) {
      transition.send('setMiniChrome', true);
    }
  },

  setupController(controller, model) {
    let { page_params = '' } = this.paramsFor(`${this.routeName}.page`);
    let [navSlug] = page_params.split('/');
    controller.setProperties({
      channelType: this.routeName,
      navRoot: get(this, 'listingSlug'),
      defaultSlug: navSlug,
      model,
      session: get(this, 'session'),
      adminURL: `${config.wnycAdminRoot}/admin`
    });
  },

  actions: {
    willTransition(transition) {
      let isExiting = !transition.targetName.match(this.routeName);
      this._super(...arguments);
      beforeTeardown();
      if (get(this, 'currentModel.channel.altLayout') && isExiting) {
        transition.send('setMiniChrome', false);
      }
      return true;
    }
  }
});
