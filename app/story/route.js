import Ember from 'ember';
import service from 'ember-service/inject';
import PlayParamMixin from 'wnyc-web-client/mixins/play-param';
import { beforeTeardown } from 'wnyc-web-client/lib/compat-hooks';
const { get } = Ember;
const { hash: waitFor } = Ember.RSVP;

export default Ember.Route.extend(PlayParamMixin, {
  metrics:      service(),
  session:      service(),
  dataPipeline: service(),
  
  setupController(controller) {
    controller.set('isMobile', window.Modernizr.touchevents);
    return this._super(...arguments);
  },
  titleToken(model) {
    return `${get(model, 'story.title')} - ${get(model, 'story.headers.brand.title')}`;
  },
  title(tokens) {
    return `${tokens[0]} - WNYC`;
  },
  model({ slug }) {
    return this.store.findRecord('django-page', `story/${slug}`.replace(/\/*$/, '/')).then(page => {
      let story = page.get('wnycContent');
      let comments = this.store.query('comment', { itemTypeId: story.get('itemTypeId'), itemId: story.get('id') });
      let relatedStories = this.store.query('story', { itemId: story.get('id'), limit: 5});
      return waitFor({
        page,
        story,
        getComments: () => comments,
        getRelatedStories: () => relatedStories,
        user: get(this, 'session.data.authenticated'),
        browserId: get(this, 'session.data.browserId')
      });
    });
  },
  afterModel(model, transition) {
    let metrics = get(this, 'metrics');
    let dataPipeline = get(this, 'dataPipeline');
    let {containers:action, title:label} = get(model, 'story.analytics');
    let nprVals = get(model, 'story.nprAnalyticsDimensions');

    if (get(model, 'story.extendedStory.headerDonateChunk')) {
      transition.send('updateDonateChunk', get(model, 'story.extendedStory.headerDonateChunk'));
    }

    // google analytics
    metrics.trackEvent({
      category: 'Viewed Story',
      action,
      label,
    });

    // NPR
    metrics.invoke('trackPage', 'NprAnalytics', {
      page: `/story/${get(model, 'story.slug')}`,
      title: label,
      nprVals,
      isNpr: true
    });
    
    // data pipeline
    dataPipeline.reportItemView({
      cms_id: get(model, 'story.id'),
      item_type: get(model, 'story.itemType'),
      site_id: get(model, 'story.siteId')
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
