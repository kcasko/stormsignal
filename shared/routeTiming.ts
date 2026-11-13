// The route's fractional travel progress is based on distance along the actual polyline,
// not point count. Arrival estimates use the provider's whole-route driving duration.
const R=6371000;
export function segmentMeters(a: number[], b: number[]): number {
  const rad=Math.PI/180;
  const dLat=(b[1]-a[1])*rad, dLon=(b[0]-a[0])*rad;
  const h=Math.sin(dLat/2)**2 + Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function routeSamples(line: number[][]): { point: number[]; fraction: number }[] {
  if(line.length<2) return [];
  const cumulative=[0];
  for(let i=1;i<line.length;i++) cumulative.push(cumulative[i-1]+segmentMeters(line[i-1],line[i]));
  const total=cumulative[cumulative.length-1];
  const fractions=[0,0.5,1];
  return fractions.map(f=>{
    if(f===0) return {point:line[0],fraction:0};
    if(f===1) return {point:line[line.length-1],fraction:1};
    if(total===0)return {point:line[Math.floor((line.length-1)*f)],fraction:f};
    const goal=total*f;
    let i=1;
    while(i<cumulative.length-1 && cumulative[i]<goal)i++;
    const seg=cumulative[i]-cumulative[i-1];
    const t=seg>0?(goal-cumulative[i-1])/seg:0;
    return {point:[line[i-1][0]+t*(line[i][0]-line[i-1][0]),line[i-1][1]+t*(line[i][1]-line[i-1][1])],fraction:f};
  });
}
export function parseDeparture(raw: string | undefined, now=Date.now()): number | null {
  if(!raw || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:\.\d{1,3})?Z$/.test(raw))return null;
  const ms=Date.parse(raw);
  return Number.isFinite(ms) && ms>=now-5*60000 && ms<=now+48*3600000 ? ms : null;
}
