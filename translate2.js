require("dotenv").config()

const { LokaliseApi } = require('@lokalise/node-api')
const fs = require('fs')
const path = require('path')
const AdmZip = require("adm-zip")
const got = require('got')

async function waitUntilUploadingDone( lokaliseApi, processId, projectId) {
  return await new Promise(resolve => {
    const interval = setInterval(async () => {
      const reloadedProcess = await lokaliseApi.queuedProcesses().get(processId, {
        project_id: projectId,
      })

      if (reloadedProcess.status === 'finished') {
        resolve(reloadedProcess.status)
        clearInterval(interval)
      }
    }, 1000)
  })
}


function restructureJsonInPlace(file1Name, file2Name, folderName) {
    // Read the contents of the first JSON file
    const jsonFile1 = path.join(folderName, file1Name);
    const file1Contents = fs.readFileSync(jsonFile1, 'utf-8');
    const json1 = JSON.parse(file1Contents);

    // Read the contents of the second JSON file
    const jsonFile2 = path.join(folderName, file2Name);
    const file2Contents = fs.readFileSync(jsonFile2, 'utf-8');
    let json2 = JSON.parse(file2Contents);

    // Function to recursively restructure the JSON
    function restructureJson(order, data) {
        const result = {};

        order.forEach(key => {
            if (data.hasOwnProperty(key)) {
                result[key] = (typeof data[key] === 'object') ? restructureJson(Object.keys(data[key]), data[key]) : data[key];
            }
        });

        return result;
    }

    // Restructure the second JSON file in place
    json2 = restructureJson(Object.keys(json1), json2);

    // Write the modified JSON back to the second file
    fs.writeFileSync(jsonFile2, JSON.stringify(json2, null, 2), 'utf-8');

    console.log('JSON restructuring in place complete.');
}



function getbase64I18n(translationFolder, filename) {
  const enFile = path.join(translationFolder, filename)
  const data = fs.readFileSync(enFile, 'utf8')
  const buff = Buffer.from(data, 'utf8')
  const base64I18n = buff.toString('base64')
  return base64I18n;
}

async function download(translationsUrl, archive) {
  try {
    const response = await got.get(translationsUrl).buffer()
    fs.writeFileSync(archive, response)
  } catch (error) {
    console.log(error)
  }
}

async function uploadFile(projectId,lokaliseApi, data, filename,lang_iso, use_automations=false) {
  // function to upload the file to the project having projectId-> projectID
  // requires : projectId of the project
  try{
    const bgProcess = await lokaliseApi.files().upload(projectId, {
      data: data,
      filename: filename,
      lang_iso: lang_iso,
      use_automations:use_automations,
      replace_modified:true
    });
    await waitUntilUploadingDone(lokaliseApi, bgProcess.process_id, projectId);
  }
  catch(error){
    console.log(`Problem happened while uploading file ${filename}`,error);
  }
  return `${filename} has been uploaded`;
}


async function main() {
  const translationFolder = path.resolve(__dirname, './src/translations');

  // INITIALIZE API CLIENT
  // NEED TO CHANGE ACTUAL API AND PROJECT ID
  const lokaliseApi = new LokaliseApi({ apiKey: 'af0281cc3fc84f51e8c36cde585d04c35c3e34c0'})
  const projectId = '78830003655b5662310a57.37586218';

  // UPLOAD TRANSLATION FILE
  console.log("Uploading translations...")

  const base64I18nEN = getbase64I18n(translationFolder,'en.json');
  // const base64I18nFR = getbase64I18n(translationFolder,'fr.json');
  // const base64I18nTR = getbase64I18n(translationFolder,'tr.json');
  // const base64I18nPT = getbase64I18n(translationFolder,'pt.json');
  // const base64I18nES = getbase64I18n(translationFolder,'es.json');

  console.log("Updating process status...")
  // uploadFile(projectId,lokaliseApi, base64I18nES, 'es.json', 'es').then((response)=>console.log(response));
  // uploadFile(projectId,lokaliseApi, base64I18nFR, 'fr.json', 'fr').then((response)=>console.log(response));;
  // uploadFile(projectId,lokaliseApi, base64I18nTR, 'tr.json', 'tr').then((response)=>console.log(response));;
  // uploadFile(projectId,lokaliseApi, base64I18nPT, 'pt.json', 'pt').then((response)=>console.log(response));;
  uploadFile(projectId,lokaliseApi, base64I18nEN, 'en.json', 'en', true).then((response)=>console.log(response));

  const keys = await lokaliseApi.keys().list({
    project_id: projectId
  })

  const keyIds = keys.items.map(function(currentValue) {
    return currentValue.key_id
  })

  console.log(keyIds)



  // DOWNLOAD TRANSLATIONS
  console.log("Downloading translations...")

  const downloadResponse = await lokaliseApi.files().download(projectId, {
    format: "json",
    original_filenames: true,
    directory_prefix: '',
    filter_langs: ['fr','pt','es','tr'],
    indentation: '2sp',
    export_sort: 'last_updated'
  })

  
  const translationsUrl = downloadResponse.bundle_url
  const archive = path.resolve(translationFolder, 'archive.zip')

  await download(translationsUrl, archive)

  // EXTRACTING TRANSLATION
  console.log('extracting translation');
  const zip = new AdmZip(archive)
  zip.extractAllTo(translationFolder, true)

  fs.unlink(archive, (err) => {
    if (err) throw err
  })

  await restructureJsonInPlace('en.json','fr.json',translationFolder);
  await restructureJsonInPlace('en.json','tr.json',translationFolder);
  await restructureJsonInPlace('en.json','es.json',translationFolder);
  await restructureJsonInPlace('en.json','pt.json',translationFolder);



}


main()
  .then(() => {
    process.exit(0)}
    )
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
