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
import { retryFromServer } from 'overhaul/lib/compat-hooks';
import PlayParamMixin from 'overhaul/mixins/play-param';

export default Route.extend(PlayParamMixin, {
  session:      service(),
  metrics:      service(),
  dataPipeline: service(),

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
  afterModel({ channel }) {
    let channelTitle = get(channel, 'title');
    let metrics = get(this, 'metrics');
    let dataPipeline = get(this, 'dataPipeline');
    let nprVals = get(channel, 'nprAnalyticsDimensions');
    
    if (channel.get('headerDonateChunk')) {
      this.send('updateDonateChunk', channel.get('headerDonateChunk'));
    }

    // google analytics
    metrics.trackEvent('GoogleAnalytics', {
      category: `Viewed ${get(channel, 'listingObjectType').capitalize()}`,
      action: channelTitle,
    });

    // NPR
    metrics.trackPage('NprAnalytics', {
      page: `/${get(this, 'listingSlug')}`,
      title: channelTitle,
      nprVals,
    });
    
    // data pipeline
    dataPipeline.reportItemView({
      cms_id: channel.get('cmsPK'),
      item_type: channel.get('listingObjectType'),
      site_id: channel.get('siteId')
    });
  },
  setupController(controller, model) {
    let { navSlug } = this.paramsFor(`${this.routeName}.well`);
    controller.setProperties({
      channelType: this.routeName,
      navRoot: get(this, 'listingSlug'),
      defaultSlug: navSlug,
      model
    });
  }
});
