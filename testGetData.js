const fetch = require('node-fetch');
const _ = require('lodash');

fetch('http://192.168.1.40/api/realTimeData.htm')
  .then(response => {
    return response.text();
  })   
  .then(bodyText => {
	  
	// hack known text
	//const testText = '{"method":"uploadsn","version":"Solax_SI_CH_2nd_20170906_DE01","type":"AL_SI4","SN":"52A3AF07","Data":[0.8,0.7,254.1,437.7,2.5,241.1,549,35,19.7,10157.7,-831,217,344,,,,,,,,,,,,,,,,,,,,,,,,,,,,,1695.38,7303.79,,,,,,,,50.10,,,0.0,0.0,0,0.00,0,0,0,0.00,0,8,0,0,0.00,0,8],"Status":"2"}';
	
	const cleansedResponse = bodyText.replace(/,,/g, ',0,').replace(/,,/g, ',0,');
	const json = JSON.parse(cleansedResponse);
	_.each( json.Data, function( dataItem, index ){
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


/*

Live datastream
1: PV1 Current
2: PV2 Current
3: PV1 Voltage
4: PV2 Voltage
5: Grid Current
6: Grid Voltage
7: Grid Power
8: Inner Temp
9: Solar Today
10: Solar Total
11: Feed In Power
12: PV1 Power
13: PV2 Power
14: Battery Voltage
15: Battery Current
16: Battery Power
17: Battery Temp
18: ???
19: Battery Capacity
20: Solar Total 2

42: Energy to Grid
43: Energy from Grid

51: Grid Frequency

54: EPS Voltage
55: EPS Current
56: EPS VA
57: EPS Frequency

63: ???
68: ???
69: Status
*/
