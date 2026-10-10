const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export class PhotoGestureState {
  constructor(){this.points=new Map();this.scale=1;this.x=0;this.y=0;this.bounds={width:1,height:1,imageWidth:1,imageHeight:1};}
  setBounds(bounds){this.bounds=bounds;this.limit();}
  limit(){const b=this.bounds;this.maxX=Math.max(0,(b.imageWidth*this.scale-b.width)/2);this.maxY=Math.max(0,(b.imageHeight*this.scale-b.height)/2);this.x=clamp(this.x,-this.maxX,this.maxX);this.y=clamp(this.y,-this.maxY,this.maxY);}
  reset(){this.points.clear();this.scale=1;this.x=0;this.y=0;this.start=null;this.pinched=false;this.limit();}
  zoomAt(scale,x=0,y=0){const next=clamp(scale,1,4),ratio=next/this.scale;this.x=x-(x-this.x)*ratio;this.y=y-(y-this.y)*ratio;this.scale=next;this.limit();}
  rebase(){const p=[...this.points.values()];if(p.length>=2){this.base={scale:this.scale,x:this.x,y:this.y,cx:(p[0].x+p[1].x)/2,cy:(p[0].y+p[1].y)/2,distance:Math.max(1,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y))};}else if(p.length)this.start={px:p[0].x,py:p[0].y,x:this.x,y:this.y};this.edgeTravel=0;}
  down(id,x,y){if(!this.points.size)this.pinched=false;this.points.set(id,{x,y});if(this.points.size>=2)this.pinched=true;this.rebase();}
  move(id,x,y){if(!this.points.has(id))return;this.points.set(id,{x,y});const p=[...this.points.values()];
    if(p.length>=2){const b=this.base,d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);this.scale=clamp(b.scale*d/b.distance,1,4);const ratio=this.scale/b.scale;this.x=(p[0].x+p[1].x)/2-(b.cx-b.x)*ratio;this.y=(p[0].y+p[1].y)/2-(b.cy-b.y)*ratio;this.limit();}
    else if(this.start){const requested=this.start.x+x-this.start.px;this.x=requested;this.y=this.start.y+y-this.start.py;this.limit();this.edgeTravel=requested-this.x;}
  }
  up(id,cancelled=false){const p=this.points.get(id),s=this.start;let direction=0,tap=false;
    if(p&&s&&this.points.size===1&&!this.pinched&&!cancelled){const dx=p.x-s.px,dy=p.y-s.py;tap=Math.hypot(dx,dy)<10;const travel=this.scale<=1.02?dx:this.edgeTravel;if(Math.abs(travel)>60&&Math.abs(dx)>Math.abs(dy)*1.25)direction=travel<0?1:-1;}
    this.points.delete(id);this.rebase();return {direction,tap};
  }
}
export function attachPhotoGestures(frame,image,{onNavigate=()=>{}}={}) {
  const state=new PhotoGestureState();let lastTap=0;
  const draw=()=>{const p=[...state.points.values()][0],drag=state.scale<=1.02&&state.points.size===1&&!state.pinched&&state.start?clamp(p.x-state.start.px,-80,80):0;image.style.transform=`translate3d(${state.x+drag}px,${state.y}px,0) scale(${state.scale})`;frame.dataset.zoomed=state.scale>1.02?'true':'false';frame.dataset.dragging=state.points.size?'true':'false';};
  const bounds=()=>{const width=frame.clientWidth,height=frame.clientHeight;if(!width||!height||!image.naturalWidth||!image.naturalHeight)return;const fit=Math.min(width/image.naturalWidth,height/image.naturalHeight,1);const imageWidth=image.naturalWidth*fit,imageHeight=image.naturalHeight*fit;image.style.width=imageWidth+'px';image.style.height=imageHeight+'px';state.setBounds({width,height,imageWidth,imageHeight});state.rebase();draw();};
  const point=event=>{const r=frame.getBoundingClientRect();return {x:event.clientX-r.left-r.width/2,y:event.clientY-r.top-r.height/2};};
  image.draggable=false;
  frame.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('button'))return;event.preventDefault();const p=point(event);state.down(event.pointerId,p.x,p.y);frame.setPointerCapture(event.pointerId);});
  frame.addEventListener('pointermove',event=>{const p=point(event);state.move(event.pointerId,p.x,p.y);draw();});
  const end=event=>{const result=state.up(event.pointerId,event.type!=='pointerup');if(result.direction)onNavigate(result.direction);else if(result.tap&&event.pointerType!=='mouse'){const now=Date.now();if(now-lastTap<300){const p=point(event);state.zoomAt(state.scale>1?1:2,p.x,p.y);lastTap=0;}else lastTap=now;}draw();};
  frame.addEventListener('pointerup',end);frame.addEventListener('pointercancel',end);
  frame.addEventListener('dblclick',event=>{if(event.target.closest('button'))return;const p=point(event);state.zoomAt(state.scale>1?1:2,p.x,p.y);draw();});
  frame.addEventListener('wheel',event=>{event.preventDefault();const p=point(event);state.zoomAt(state.scale*(event.deltaY<0?1.15:1/1.15),p.x,p.y);draw();},{passive:false});
  image.addEventListener('load',bounds);
  const observer=new ResizeObserver(bounds);observer.observe(frame);bounds();
  return {reset(){state.reset();bounds();},zoom(factor){state.zoomAt(state.scale*factor);draw();},dispose(){observer.disconnect();},state};
}
