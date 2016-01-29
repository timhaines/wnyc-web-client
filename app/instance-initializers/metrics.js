import ENV from '../config/environment';

const {
  googleAnalyticsKey:id,
  wnycAccountAPI
} = ENV;

export function initialize(applicationInstance) {
  const metrics = applicationInstance.lookup('service:metrics');
  const endpoint = 'api/v1/analytics/ga';
  const mailchimp = String(window.location).match(/utm_term=(\d+_\w+-\w+-\w+)/);

  metrics.activateAdapters([{
    name: 'DataWarehouse',
    config: {
      host: wnycAccountAPI,
      endpoint: endpoint,
      debug: /alertTracking/.test(window.location.search)
    }
  }, {
    name: 'GoogleAnalytics',
    config: {
      id
    }
  }])

  // TODO: send these on every pageView or just once per session?
  metrics.trackBrowser();

  if (mailchimp !== null) {
    metrics.trackEvent('DataWarehouse', {
      eventName: 'trackMailChimpID',
      mailchimp: encodeURIComponent(mailchimp[1])
    })
  }
}

export default {
  name: 'metrics',
  initialize
}
