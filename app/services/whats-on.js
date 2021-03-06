import ENV from 'wnyc-web-client/config/environment';
import wrapAjax from 'wnyc-web-client/lib/wrap-ajax';
import Service from 'ember-service';
import get from 'ember-metal/get';
import { canonicalize } from 'wnyc-web-client/services/script-loader';

let { wnycAPI } = ENV;
wnycAPI = canonicalize(wnycAPI);

export default Service.extend({
  endPoint: 'api/v1/whats_on/',
  isLive(pk) {
    let endPoint = get(this, 'endPoint');
    let url = `${wnycAPI}${endPoint}`;

    return wrapAjax(url).then(d => this._extractStatus(d, pk));
  },

  _extractStatus(data, pk) {
    let stations = Object.keys(data);
    for (let i = 0; i < stations.length; i++) {
      let stationSlug = stations[i];
      let station = data[stationSlug];
      // for some reason if the what's on story is an EPISODE, it's under episode_pk,
      // but if it's a SEGMENT, that pk is just on pk
      let onAirPk = get(station, 'current_show.episode_pk') || get(station, 'current_show.pk');
      let endtime = get(station, 'current_show.end');

      if (String(onAirPk) === pk) {
        return [true, endtime, stationSlug];
      }
    }

    return [false, false];
  }
});
