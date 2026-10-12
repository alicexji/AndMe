type Row = Record<string, unknown>
async function getJSON(url:string, source:string) {
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)})
  if(!response.ok) throw new Error(`${source} returned ${response.status}`)
  return response.json()
}
export function currencyRecords(data:{rates:Record<string,Record<string,number>>}):Row[] {
  if(!data.rates || typeof data.rates!=='object') throw new Error('Exchange-rate response is missing rates')
  const previous=new Map<string,number>(), records:Row[]=[]
  for(const date of Object.keys(data.rates).sort()) for(const [currency,rate] of Object.entries(data.rates[date])) {
    if(!Number.isFinite(rate) || rate<=0 || !Number.isFinite(Date.parse(date))) continue
    const last=previous.get(currency)
    if(last!==undefined) records.push({date,pair:`USD/${currency}`,rate,changePercent:(rate/last-1)*100})
    previous.set(currency,rate)
  }
  if(!records.length) throw new Error('No exchange-rate history available')
  return records
}
export async function loadCurrencies():Promise<Row[]> {
  const year=new Date().getUTCFullYear()-1
  // v1 is maintained indefinitely and exposes the ECB historical series.
  return currencyRecords(await getJSON(`https://api.frankfurter.dev/v1/${year}-01-01..${year}-12-31?base=USD&symbols=EUR,GBP,JPY,CAD,AUD`,'Frankfurter'))
}
export function biodiversityRecords(data:{results:Row[]}):Row[] {
  if(!Array.isArray(data.results)) throw new Error('GBIF response is missing observations')
  const rows=data.results.filter(r=>typeof r.decimalLatitude==='number' && Number.isFinite(r.decimalLatitude) && typeof r.decimalLongitude==='number' && Number.isFinite(r.decimalLongitude)).map(r=>({
    key:r.key,species:r.species||r.scientificName||'Unidentified species',country:r.country||r.countryCode||'Unknown',latitude:r.decimalLatitude,longitude:r.decimalLongitude,
    observed:r.eventDate||null,year:r.year||null,dataset:r.datasetKey,license:r.license,source:`https://www.gbif.org/occurrence/${r.key}`
  }))
  if(!rows.length) throw new Error('No geolocated observations available')
  return rows
}
export async function loadBiodiversity():Promise<Row[]> {
  return biodiversityRecords(await getJSON('https://api.gbif.org/v1/occurrence/search?limit=300&hasCoordinate=true&hasGeospatialIssue=false&license=CC0_1_0','GBIF'))
}
