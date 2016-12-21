import ENV from '../config/environment';
import DS from 'ember-data';
import DataAdapterMixin from 'ember-simple-auth/mixins/data-adapter-mixin';

export default DS.JSONAPIAdapter.extend(DataAdapterMixin, {
  authorizer: 'authorizer:nypr',
  host: ENV.wnycAuthAPI,
  buildURL(modelName, id, snapshot, requestType/*, query*/) {
    if (/createRecord|updateRecord|deleteRecord/.test(requestType)) {
      return `${this.host}/user`;
    } else if (requestType.startsWith('find')) {
      return `${this.host}/session`;
    }
  }
});
