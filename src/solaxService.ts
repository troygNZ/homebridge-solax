import fetch from 'node-fetch';
import _ from 'lodash';
import { Logger } from 'homebridge/lib/logger';

export const getValuesAsync = async (log: Logger): Promise<InverterLiveMetrics> => {
  try {
    // TODO, shift in to config
    const response = await fetch('http://192.168.1.40/api/realTimeData.htm');
    const bodyText = await response.text();
    //log.debug(bodyText);
    const cleansedResponse = bodyText.replace(/,,/g, ',0,').replace(/,,/g, ',0,');
    const json = JSON.parse(cleansedResponse);
    let genPower = 0;
    let exportPower = 0;
            
    _.each( json.Data, ( dataItem, index: number ) => {
      if(index + 1=== 7) {
        //log.debug(dataItem);
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