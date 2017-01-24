/*jshint node:true*/
function coverageFolder() {
  var circleArtifactsFolder = process.env['CIRCLE_ARTIFACTS'];
  return circleArtifactsFolder || 'coverage';
}

module.exports = {
  coverageEnvVar: 'CI',
  useBabelInstrumenter: true,
  coverageFolder: coverageFolder(),
};
