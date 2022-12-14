// 数据库文件下载地址, 包含国家和地区   https://www.naturalearthdata.com/downloads/
// 加载数据查看详情  https://ngageoint.github.io/geopackage-viewer-js/
// 使用sqlite3解析数据库生成文件, 目前生成了国家->子区, 县乡镇也可以通过数据库里数据生成

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

    // 不包含adm0_a3可能不是
    if(!row.adm1_code || row.adm1_code.indexOf(row.adm0_a3) === -1){
      return;
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
      // 国家代码
      iso_a3: row.adm0_a3,
      // 子区数字代码
      iso_n3: row.diss_me,
      // 子区代码`国家-子区`
      iso_32: row.iso_3166_2,
      // 子区代码
      iso_code: row.iso_3166_2.split('-')[1] || row.iso_3166_2,
    });

    //console.log(provinces);
  });
});


db.all(`SELECT * FROM ne_10m_admin_0_countries where type="Sovereign country" or type="Country"`, (err, rows) => {
  if (err) {
    console.error(err.message);
  }

  let countries: {[key: string]: any} = {};
  let areas: {[key: string]: any[]} = {};
  rows.map((row) => {
    //console.log(row.fid + "\t" + row.NAME_ZH + "\t" + row.ADM0_A3_CN);
    let temp = {
      name_zh: row.ADM0_A3 === 'TWN' ? '台湾' : row.NAME_ZH,
      name_en: row.NAME_EN,
      // 不一定是国家代码, 比如香港、澳门等有自己的a3代码
      iso_a3: row.ADM0_A3,
      iso_n3: row.ISO_N3,
      iso_a2: row.ISO_A2,
      iso_code: row.ISO_A2.split('-')[1] || row.ISO_A2,
      subs: provinces[row.ADM0_A3] || []
    };
  
    // 表结构有缺陷, 不能把区域归类
    // ISO_A2有-代表不是国家, 可能是地区
    // FCLASS_ISO有dependency代表不是国家, 但很难把区域归类, 这里定义了映射
    if(!row.ISO_A2 || !row.FCLASS_ISO){
      return;
    }else if(row.ISO_A2.indexOf('-') > -1){

      let countryA2 = row.ISO_A2.split('-')[0];
      if(!areas[countryA2]){
        areas[countryA2] = [];
      }
      areas[countryA2].push(temp);

    }else if(row.FCLASS_ISO.indexOf('dependency') > -1){

      let matchs: {[key: string]: any} = {
        HKG: 'CN',
        MAC: 'CN'
      }

      if(matchs[row.ADM0_A3]){
        if(!areas[matchs[row.ADM0_A3]]){
          areas[matchs[row.ADM0_A3]] = [];
        }
        areas[matchs[row.ADM0_A3]].push(temp);
      }
      
    }else{
      countries[row.ADM0_A3] = temp;
    }
  });

  Object.keys(countries).map((key) => {
    countries[key].subs = countries[key].subs.concat(areas[countries[key].iso_a2] || []);
  });

  if(fs.existsSync(file)){
    fs.rmSync(file);
  }
  if(!fs.existsSync(dirName)){
      fs.mkdirSync(dirName);
  }

  let list = JSON.stringify(Object.keys(countries).sort((a, b) => a < b ? -1 : a > b ? 1: 0).map(k => countries[k]));
  fs.writeFileSync(file, `export const countriesAreasProvinces = ${list};`);  
});

db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Close the database connection.');
});
