import Papa from "papaparse";
import './'

function csvToJson(csvText) {
    const file = '.'
  Papa.parse(file, {
    header: true,
    complete: function (results) {
      console.log(results.data); // JSON
    },
  });
}