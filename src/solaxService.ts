import fetch from 'node-fetch';
import _ from 'lodash';
import { Logger } from 'homebridge/lib/logger';
import { Config } from './config';

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
  BatteryCapacity = 19,
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

export const getValuesAsync = async (log: Logger, config: Config): Promise<InverterLiveMetrics> => {
  try {
    const response = await fetch(`${config.address}/api/realTimeData.htm`);
    const bodyText = await response.text();
    const cleansedResponse = bodyText.replace(/,,/g, ',0,').replace(/,,/g, ',0,');
    const json = JSON.parse(cleansedResponse);
    let genPower = 0;
    let exportPower = 0;
            
    _.each( json.Data, ( dataItem, index: number ) => {
      // Lookup index data provided starts at 1 :|
      const lookupIndex = index + 1;
      if(lookupIndex === LiveDatastreamFields.GridPower as number) {
        genPower = parseInt(dataItem);
      } else if (lookupIndex === LiveDatastreamFields.FeedInPower as number) {
        exportPower = parseInt(dataItem);
      }
    });
    return {
      generationWatts: genPower,
      exportedWatts: exportPower,
    };
  } catch (error) {
    log.debug(`That did not go well. Error: ${error}`);
    throw error;
  }
};

export interface InverterLiveMetrics {
    generationWatts: number;
    exportedWatts: number;
}