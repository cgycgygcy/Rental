(function(root){
  'use strict';
  const replacements={'寶':'宝','鑽':'钻','灣':'湾','將':'将','軍':'军','調':'调','嶺':'岭','貢':'贡','區':'区','門':'门','東':'东','離':'离','島':'岛','觀':'观','黃':'黄','龍':'龙','荃':'荃','藍':'蓝','頭':'头','盤':'盘','號':'号','樓':'楼','層':'层','廳':'厅','間':'间','單':'单','實':'实','積':'积','呎':'尺','幣':'币','約':'约','個':'个','兩':'两','車':'车','鐘':'钟','學':'学','轉':'转','聯':'联','絡':'络','電':'电','話':'话','傢':'家','儲':'储','萬':'万','鄰':'邻','業':'业','產':'产','臥':'卧'};
  function normalize(text){return String(text).normalize('NFKC').replace(/[寶鑽灣將軍調嶺貢區門東離島觀黃龍藍頭盤號樓層廳間單實積呎幣約個兩車鐘學轉聯絡電話傢儲萬鄰業產臥]/g,c=>replacements[c]||c);}
  function parse(text,areas){
    const originalLines=String(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    const lines=originalLines.map(line=>normalize(line).replace(/\s+/g,''));
    const all=lines.join('\n');
    const result={name:'',district:'',rent:'',commute:'',term:'',deposit:'',bedrooms:'',area:'',source:'',note:'',found:[],missing:[]};
    const number=s=>Number(s.replace(/,/g,''));
    const priceLines=lines.filter(line=>!/(?:售[价價]|售盘|按揭|编号|楼盘号|物业号)/i.test(line));
    const rentPatterns=[/(?:月租|租金|人均|每人|租价)[:：]?(?:HK\$|HKD\$?|港币|港元|\$)?([\d,]+(?:\.\d+)?)(万|[kK])?/,/(?:HK\$|HKD\$?|港币|港元|\$)([\d,]+(?:\.\d+)?)(万|[kK])?(?:元)?(?:\/月|每月|月租)?/i,/([\d,]{4,6})(?:元|港元)?(?:\/人|\/床|每人|每月|\/月)/];
    outer:for(const [index,pattern] of rentPatterns.entries())for(const line of priceLines){if(index===1&&/(?:押金|按金|deposit)/i.test(line)&&!/(?:月租|租金|人均|每人|租[价價])/i.test(line))continue;const m=line.match(pattern);if(!m)continue;const value=number(m[1])*(m[2]==='万'?10000:/k/i.test(m[2]||'')?1000:1);if(value>=1000&&value<=100000){result.rent=String(value);result.found.push('月租');break outer;}}
    const specific=['大埔仔','清水湾','西贡','坑口','将军澳','调景岭','宝琳','康城','彩虹','钻石山','牛池湾','九龙湾','蓝田','油塘'];
    const regionAliases={'中西':'中西区','湾仔':'湾仔区','油尖旺':'油尖旺区','深水埗':'深水埗区','九龙城':'九龙城区','黄大仙':'黄大仙区','观塘':'观塘区','葵青':'葵青区','荃湾':'荃湾区','屯门':'屯门区','元朗':'元朗区','大埔':'大埔区','沙田':'沙田区','离岛':'离岛区'};
    result.district=specific.find(area=>all.includes(area))||(areas||[]).filter(area=>area.endsWith('区')).find(area=>all.includes(area))||Object.entries(regionAliases).find(([alias])=>all.includes(alias))?.[1]||'';
    if(result.district)result.found.push('区域');
    const titleIndex=lines.findIndex(line=>line.length<=90&&!/(?:编号|物业号|联络|电话|微信)/.test(line)&&/(?:村屋|屋苑|唐楼|合租|宿舍|单间|公寓|花园|海岸|豪庭|中心|大厦|租盘|出租)/.test(line));
    if(titleIndex>=0){result.name=originalLines[titleIndex].replace(/\s+/g,' ').replace(/\[代理[盤盘]\]/g,'').trim().slice(0,70);result.found.push('房源名称');}
    const room=all.match(/([一二三四五六七八九两\d]+)(?:房|卧)(?:[一二三四五六七八九两\d]*厅)?(?:[,，、]?[一二三四五六七八九两\d]+(?:浴室?|厕|卫))?/);
    if(room){result.bedrooms=room[0];result.found.push('房型');}
    const area=all.match(/(?:实用(?:面积)?[:：]?)?([\d,]{2,5}(?:\.\d+)?)\s*(平方英尺|平方公尺|平方尺|平方米|sq\.?ft|ft²|㎡|m²)/i);
    if(area){result.area=area[1]+' '+(/^(?:平方英尺|平方尺|sq\.?ft|ft²)$/i.test(area[2])?'平方呎':'平方米');result.found.push('面积');}
    const commute=lines.filter(line=>/(?:科大|HKUST|到校|通勤)/i.test(line)).join('\n').match(/(?:通勤|车程|步行|到校|科大|HKUST)[^\d\n]{0,12}(\d{1,3})(?:分钟|分|min)|(?:(\d{1,3})(?:分钟|分|min)[^\n]{0,10}(?:到校|科大|HKUST))/i);
    if(commute){const value=Number(commute[1]||commute[2]);if(value>0&&value<240){result.commute=String(value);result.found.push('通勤');}}
    const term=all.match(/(?:租期|租约|lease)[^\d\n]{0,8}(\d{1,2})(?:个月|月|months?)/i);
    if(term&&+term[1]>0&&+term[1]<=60){result.term=term[1];result.found.push('租期');}
    const deposit=all.match(/(?:押金|按金|deposit)[^\d\n]{0,8}(\d+(?:\.\d+)?)(?:个月|月)/i)||all.match(/押(\d+)付\d/);
    if(deposit&&+deposit[1]<=12){result.deposit=deposit[1];result.found.push('押金');}
    if(/代理盘|代理提供|中介|地产|地產/.test(all))result.source='中介';
    if(!result.source&&/小红书|小紅書/.test(all))result.source='小红书';
    if(result.source)result.found.push('来源');
    for(const [key,label] of [['rent','月租'],['commute','到科大的通勤'],['term','租期'],['deposit','押金']])if(!result[key])result.missing.push(label);
    return result;
  }
  const api={parse,normalize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.RentalOCR=api;
})(typeof window!=='undefined'?window:globalThis);
