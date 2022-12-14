// 数据库文件下载地址, 包含国家和地区   https://www.naturalearthdata.com/downloads/
// 加载数据查看详情  https://ngageoint.github.io/geopackage-viewer-js/
// 使用sqlite3解析数据库生成文件

import fs, { open, close, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { sep } from 'path';
import { verbose } from 'sqlite3';

const dirName = `.${sep}file`
const fileName = 'countries_areas_provinces.ts';
const file = `${dirName}${sep}${fileName}`;

const sqlite3 = verbose();
let db = new sqlite3.Database('./db/natural_earth_vector.gpkg', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the natural_earth_vector database.');
});


let provinces: {[key: string]: any} = {};
db.serialize(() => {
  let count = 0;
  db.each(`SELECT * FROM ne_10m_admin_1_states_provinces`, (err, row) => {
    if (err) {
      console.error(err.message);
    }
    //console.log(row.fid + "\t" + row.name_zh);
    count++;
    //console.log('count: ' + "\t" + count);

    if(!provinces[row.adm0_a3]){
      provinces[row.adm0_a3] = [];
    }

    provinces[row.adm0_a3].push({
      name_zh: row.name_zh,
      name_en: row.name_en,
      iso_a3: row.adm0_a3,
      iso_n3: row.diss_me
    });

    //console.log(provinces);
  });
});


let countries: {[key: string]: any} = {};
db.each(`SELECT * FROM ne_10m_admin_0_countries`, (err, row) => {
  if (err) {
    console.error(err.message);
  }
  //console.log(row.fid + "\t" + row.NAME_ZH + "\t" + row.ADM0_A3_CN);
  countries[row.ADM0_A3_CN] = {
    name_zh: row.NAME_ZH,
    name_en: row.NAME_EN,
    iso_a3: row.ADM0_A3_CN,
    iso_n3: row.ISO_N3,
    regions: provinces[row.ADM0_A3_CN] || []
  };
  //console.log(countries);

  if(fs.existsSync(file)){
    fs.rmSync(file);
  }
  if(!fs.existsSync(dirName)){
      fs.mkdirSync(dirName);
  }

  fs.writeFileSync(file, `export const countriesAreasProvinces = ${JSON.stringify(countries)};`);
});


db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Close the database connection.');
});
