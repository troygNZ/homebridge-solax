import fetch from "node-fetch";
import _ from "lodash";

    export const getValuesAsync = async (): Promise<InverterLiveMetrics> => {
        try {

            const response = await fetch('http://192.168.1.40/api/realTimeData.htm', {   
                mode: 'no-cors'});
            const bodyText = await response.text();
            
            const cleansedResponse = bodyText.replace(/,,/g, ',0,').replace(/,,/g, ',0,');
            const json = JSON.parse(cleansedResponse);
            let genPower: number = 0;
            let exportPower: number = 0;
            
            _.each( json.Data, function( dataItem, index: number ){
                if(index + 1=== 7) {
                    genPower = parseInt(dataItem);
                }
                else if (index + 1 === 11) {
                    exportPower = parseInt(dataItem);
                }
            });
            return {
                generationWatts: genPower,
                exportedWatts: exportPower
            }
        }
        catch (error) {
            console.log(`That did not go well. Error: ${error}`)
            throw error
        }
    }
    export class solaxService  {
    getValues() {
        fetch('http://192.168.1.40/api/realTimeData.htm')
        .then(response => {
          return response.text();
        }).then(bodyText => {            
            const cleansedResponse = bodyText.replace(/,,/g, ',0,').replace(/,,/g, ',0,');
            const json = JSON.parse(cleansedResponse);
            _.each( json.Data, function( dataItem, index: number ){
                //console.log(`${index + 1} - ${dataItem}`);
                if(index + 1=== 7) {
                    console.log(`PV Power (Watts) = ${dataItem}`);
                }
                else if (index + 1 === 11) {
                    console.log(`Import/Export Power (Watts) = ${dataItem}`);
                }
            });
            return json;
          })
          .catch(err => console.log(err));    
    }
}

export interface InverterLiveMetrics {
    generationWatts: number;
    exportedWatts: number;
}   