export interface InverterMetrics {
  timestamp: Date;
  generationWatts: number;
  exportedWatts: number;
  batteryPercentage: number;
  batteryPowerWatts: number;
  pv1PowerWatts: number;
  pv2PowerWatts: number;
}
