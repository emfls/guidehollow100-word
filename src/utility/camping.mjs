export function packingList(values) {
  const number=(key,min,max)=>{
    const text=String(values[key]??'').trim(), n=Number(text);
    if(!text||!Number.isInteger(n)||n<min||n>max)throw Error(key==='people'?'인원은1~50명으로 입력하세요.':'숙박은1~30박으로 입력하세요.');
    return n;
  };
  const people=number('people',1,50), nights=number('nights',1,30);
  if(!['mild','cold','rain'].includes(values.weather))throw Error('날씨를 골라 주세요.');
  const items=[
    ['침낭·매트',people,'인분'],['의자',people,'개'],['식기·수저',people,'세트'],
    ['갈아입을 옷',people*(nights+1),'벌'],['쓰레기봉투',nights+1,'장'],
    ['텐트·팩·로프',1,'세트'],['조명·충전기',1,'세트'],['음식·마실 물',1,'별도 준비'],
  ];
  if(values.weather==='cold')items.push(['보온 옷·침구',people,'인분']);
  if(values.weather==='rain')items.push(['우비·방수 가방',people,'인분'],['방수포',1,'개']);
  const text=people+'명 · '+nights+'박 준비 목록\n\n'+items.map(([name,n,unit])=>'□ '+name+' '+n+unit).join('\n')+'\n\n기본 목록입니다. 예보·야영장 규칙·가지고 있는 장비에 맞게 조정하세요.';
  return {text,download:{name:'캠핑-준비목록.txt',type:'text/plain;charset=utf-8',content:text}};
}
export const tools=[{slug:'camping',title:'캠핑 준비물 만들기',description:'인원과 숙박 일수에 맞는 기본 준비 목록을 만드세요.',fields:[
  {name:'people',label:'함께 가는 인원(명)',type:'number',required:true,min:1,max:50,step:1},
  {name:'nights',label:'숙박 일수(박)',type:'number',required:true,min:1,max:30,step:1},
  {name:'weather',label:'예상 날씨',type:'select',required:true,options:[{value:'mild',label:'보통'},{value:'cold',label:'추움'},{value:'rain',label:'비'}]},
],run:packingList}];
