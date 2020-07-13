import fetch from "node-fetch";
import _ from "lodash";
import { Logger } from "homebridge/lib/logger";
import Config from "./config";
import { InverterMetrics } from "./inverterMetrics";

enum LiveDatastreamFields {
  PV1Current = 1,
  PV2Current = 2,
  PV1Voltage = 3,
  PV2Voltage = 4,
  GridCurrent = 5,
  GridVoltage = 6,
  GridPower = 7,
  InnerTemp = 8,
  SolarToday = 9,
  SolarTotal = 10,
  FeedInPower = 11,
  PV1Power = 12,
  PV2Power = 13,
  BatteryVoltage = 14,
  BatteryCurrent = 15,
  BatteryPower = 16,
  BatteryTemp = 17,
  BatteryCapacity = 18,
  SolarTotal2 = 20,
  EnergyToGrid = 42,
  EnergyFromGrid = 43,
  GridFrequency = 51,
  EPSVoltage = 54,
  EPSCurrent = 55,
  EPSVA = 56,
  EPSFrequency = 57,
  Status = 69,
}

export const getValuesAsync = async (log: Logger, config: Config): Promise<InverterMetrics> => {
  try {
    const response = await fetch(`${config.address}/api/realTimeData.htm`, { timeout: config.pollingFrequencySeconds * 1000 });
    if (response.ok) {
      const bodyText = await response.text();
      // Test string with battery data. Where 67 = battery percentage, and 2259 figure is the current watts going into the battery.
      //const bodyText =
      //  '{"method":"uploadsn","version":"Solax_SI_CH_2nd_20160912_DE02","type":"AL_SE","SN":"serialnumber","Data":[6.1,6.4,212.0,178.9,0.9,245.6,97,37,2.2,8319.2,-48,1293,1144,54.78,41.19,2259,26,67,0.0,2823.5,,,,,,,,,,,,,,,,,,,,,,0.00,0.00,,,,,,,,50.03,,,0.0,0.0,0,0.00,0,0,0,0.00,0,9,0,0,0.00,0,9],"Status":"2"}';
      const cleansedResponse = bodyText.replace(/,,/g, ",0,").replace(/,,/g, ",0,");
      const json = JSON.parse(cleansedResponse);
      let genPower: number | null = null;
      let exportPower: number | null = null;
      let batteryPercentage: number | null = null;
      let batteryPowerWatts: number | null = null;
      let pv1PowerWatts: number | null = null;
      let pv2PowerWatts: number | null = null;

      _.each(json.Data, (dataItem, index: number) => {
        // Lookup index data provided starts at 1 :|
        //log.debug(`${index + 1} - dataItem`);
        const lookupIndex = index + 1;
        if (lookupIndex === (LiveDatastreamFields.GridPower as number)) {
          genPower = parseInt(dataItem);
        } else if (lookupIndex === (LiveDatastreamFields.FeedInPower as number)) {
          exportPower = parseInt(dataItem);
        } else if (lookupIndex === (LiveDatastreamFields.BatteryCapacity as number)) {
          batteryPercentage = parseInt(dataItem);
        } else if (lookupIndex === (LiveDatastreamFields.BatteryPower as number)) {
          batteryPowerWatts = parseInt(dataItem);
        } else if (lookupIndex === (LiveDatastreamFields.PV1Power as number)) {
          pv1PowerWatts = parseInt(dataItem);
        } else if (lookupIndex === (LiveDatastreamFields.PV2Power as number)) {
          pv2PowerWatts = parseInt(dataItem);
        }
      });

      log.debug("Power Gen: " + genPower);
      log.debug("Export: " + exportPower);
      log.debug("Battery Percentage: " + batteryPercentage);
      log.debug("Battery Power: " + batteryPowerWatts);
      log.debug("PV1: " + pv1PowerWatts);
      log.debug("PV2: " + pv2PowerWatts);

      return {
        timestamp: new Date(),
        generationWatts: genPower ?? 0,
        exportedWatts: exportPower ?? 0,
        batteryPercentage: batteryPercentage ?? 0,
        batteryPowerWatts: batteryPowerWatts ?? 0,
        pv1PowerWatts: pv1PowerWatts ?? 0,
        pv2PowerWatts: pv2PowerWatts ?? 0,
      };
    } else {
      log.error("Failed call to solaxInverter");
      throw Error(response.statusText);
    }
  } catch (error) {
    log.error(`That did not go well. Error: ${error}`);
    throw error;
  }
};
