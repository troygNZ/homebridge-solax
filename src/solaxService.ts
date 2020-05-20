import fetch from 'node-fetch';
import _ from 'lodash';

export const getValuesAsync = async (): Promise<InverterLiveMetrics> => {
  try {
    // TODO, shift in to config
    const response = await fetch('http://192.168.1.40/api/realTimeData.htm');
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
    console.log(`That did not go well. Error: ${error}`);
    throw error;
  }
};

export interface InverterLiveMetrics {
    generationWatts: number;
    exportedWatts: number;
}   