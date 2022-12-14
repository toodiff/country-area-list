import fs, { open, close, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { sep } from 'path';
import https from 'node:https';
import { Buffer } from 'node:buffer';
import * as iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

const url = 'https://unstats.un.org/unsd/methodology/m49/';
const dirName = `.${sep}file`
const fileName = 'countries_areas.ts';
const file = `${dirName}${sep}${fileName}`;

https.get(url, (res) => {
    let chunks: any[] = [];

    if(res.statusCode === 200){
        res.on('data', (chunk) => chunks.push(chunk));

        res.on('end', async () => {
            let str = Buffer.concat(chunks);

            let bufferData = iconv.decode(str, 'utf-8');
            let $ = cheerio.load(bufferData);

            let chn = Array.from($('#CHN_COUNTRIES').find('tr')).filter((t, i) => i);
            let eng = Array.from($('#ENG_COUNTRIES').find('tr')).filter((t, i) => i)
            .map((t, i) => {
                let tds = $(t).find('td'); 
                let chntds = $(chn[i]).find('td'); 
                return {
                    name_zh: chntds.eq(0).text().trim(),
                    name_en: tds.eq(0).text().trim(), 
                    iso_n3: tds.eq(1).text().trim(), 
                    iso_a3: tds.eq(2).text().trim()
                }
            });

            if(fs.existsSync(file)){
                fs.rmSync(file);
            }
            if(!fs.existsSync(dirName)){
                fs.mkdirSync(dirName);
            }

            fs.writeFileSync(file, `export const countriesAreas = ${JSON.stringify(eng)};`);
        });
    }

    res.on('error', (err) => {
        console.error(err);
    });
});