export default interface InverterLiveMetrics {
  generationWatts: number;
  exportedWatts: number;
  batteryPercentage: number;
  batteryPowerWatts: number;
  pv1PowerWatts: number;
  pv2PowerWatts: number;
}
