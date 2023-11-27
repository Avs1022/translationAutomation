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


async function download(translationsUrl, archive) {
  try {
    const response = await got.get(translationsUrl).buffer()
    fs.writeFileSync(archive, response)
  } catch (error) {
    console.log(error)
  }
}


async function main() {
  const translationFolder = path.resolve(__dirname, './src/translations')

  // INITIALIZE API CLIENT
  // NEED TO CHANGE ACTUAL API AND PROJECT ID
  const lokaliseApi = new LokaliseApi({ apiKey: 'af0281cc3fc84f51e8c36cde585d04c35c3e34c0'})
  const projectId = '78830003655b5662310a57.37586218';

  // UPLOAD TRANSLATION FILE
  console.log("Uploading translations...")

  const enFile = path.join(translationFolder, 'en.json')
  const data = fs.readFileSync(enFile, 'utf8')
  const buff = Buffer.from(data, 'utf8')
  const base64I18n = buff.toString('base64')

  const bgProcess = await lokaliseApi.files().upload(projectId, {
    data: base64I18n,
    filename: "en.json",
    lang_iso: "en",
    use_automations:true,
    replace_modified:true
  })

  console.log("Updating process status...")

  await waitUntilUploadingDone(lokaliseApi, bgProcess.process_id, projectId)

  console.log("Uploading is done!")


  // LIST TRANSLATION KEYS
  console.log("Getting created translation keys...")

  const keys = await lokaliseApi.keys().list({
    project_id: projectId
  })

  const keyIds = keys.items.map(function(currentValue) {
    return currentValue.key_id
  })

  // console.log(keyIds)
  setTimeout(() => console.log('downloading after 10 seconds'),10000);


  // DOWNLOAD TRANSLATIONS
  console.log("Downloading translations...")

  const downloadResponse = await lokaliseApi.files().download(projectId, {
    format: "json",
    original_filenames: true,
    directory_prefix: '',
    filter_langs: ['fr','tr','es','pt'],
    indentation: '2sp',
    export_sort: 'last_updated'
  })

  
  const translationsUrl = downloadResponse.bundle_url
  const archive = path.resolve(translationFolder, 'archive.zip')

  await download(translationsUrl, archive)

  // EXTRACTING TRANSLATION

  const zip = new AdmZip(archive)
  zip.extractAllTo(translationFolder, true)

  fs.unlink(archive, (err) => {
    if (err) throw err
  })
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
