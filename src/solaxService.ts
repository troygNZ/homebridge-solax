import fetch from 'node-fetch';
import _ from 'lodash';
import { Logger } from 'homebridge/lib/logger';
import { Config } from './config';

export const getValuesAsync = async (log: Logger, config: Config): Promise<InverterLiveMetrics> => {
  try {
    const response = await fetch(`${config.address}/api/realTimeData.htm`);
    const bodyText = await response.text();
    const cleansedResponse = bodyText.replace(/,,/g, ',0,').replace(/,,/g, ',0,');
    const json = JSON.parse(cleansedResponse);
    let genPower = 0;
    let exportPower = 0;
            
    _.each( json.Data, ( dataItem, index: number ) => {
      if(index + 1=== 7) {
        genPower = parseInt(dataItem);
      } else if (index + 1 === 11) {
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