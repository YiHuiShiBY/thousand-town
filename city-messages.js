/* 漂流瓶层：留言板（GET https://api.yihuishi.com/api/board）的公开留言，
 * 每条漂成运河上的一只瓶子——白天随波轻晃，入夜透出暖光，像谁在河上
 * 放了一盏小小的许愿灯。点击拾取走 CityScene.pickMessage，卡片在
 * sketch.js 一侧用 textContent 渲染；接口不可达时河面保持无瓶，
 * 小镇离线可用的承诺不受影响。
 *
 * 尺寸沿用项目自己的建筑比例（一层 6、行人头顶 4.35，见 city-frontage.js
 * 卷首）：瓶身取行人的一半高上下，远看是浮标，近看读得出信纸的暖色。 */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CityMessages=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const MAX_BOTTLES=12;
  // 落点窗避开四座桥（z=±80 车行、±40 人行）与五条横街（city-model.js:72-86）。
  const BLOCK_Z=[-160,-80,-40,0,40,80,160];
  function slots(){
    const out=[];
    for(let z=-232;z<=232;z+=32){if(BLOCK_Z.every(b=>Math.abs(z-b)>=20))out.push(z);}
    return out.length?out:[100,-100];
  }
  function create(T,kit,city){
    const group=new T.Group();group.name='message-bottles';
    let bottles=[];let waterY=0;
    const bodyGeo=new T.SphereGeometry(1,14,12);
    const neckGeo=new T.CylinderGeometry(.22,.34,1,10);
    const corkGeo=new T.CylinderGeometry(.26,.26,.42,8);
    const rollGeo=new T.CylinderGeometry(.17,.17,1.15,8);
    // 隐形拾取球：远景里瓶身只有几个像素，点不中就没有意义；材质不渲染但射线可命中。
    const hitGeo=new T.SphereGeometry(2.3,8,6);
    const hitMat=new T.MeshBasicMaterial();hitMat.visible=false;
    const glassMat=new T.MeshStandardMaterial({color:'#cfe4df',roughness:.18,metalness:0,transparent:true,opacity:.72});
    const rollMat=new T.MeshStandardMaterial({color:'#f4e3bd',emissive:'#ffc46a',emissiveIntensity:.25,roughness:.85});
    const corkMat=new T.MeshStandardMaterial({color:'#9a6f4d',roughness:.9});
    function setMessages(list,waterLevel){
      for(const b of bottles)group.remove(b);
      bottles=[];
      if(Number.isFinite(waterLevel))waterY=waterLevel;
      const z=slots();
      list.slice(0,MAX_BOTTLES).forEach((m,i)=>{
        const side=i%2?1:-1;
        const bottle=new T.Group();
        const body=new T.Mesh(bodyGeo,glassMat);body.scale.set(.62,.92,.62);
        const neck=new T.Mesh(neckGeo,glassMat);neck.position.y=1.08;neck.scale.set(1,.8,1);
        const cork=new T.Mesh(corkGeo,corkMat);cork.position.y=1.52;
        const roll=new T.Mesh(rollGeo,rollMat);roll.scale.set(1,.82,1);
        const hit=new T.Mesh(hitGeo,hitMat);
        bottle.add(body,neck,cork,roll,hit);
        bottle.position.set(side*(7+(i%3)*2.2),waterY+.34,z[(i*3+1)%z.length]+(i%5));
        bottle.rotation.z=side>0?-.22:.22;bottle.rotation.y=i*1.7;
        bottle.userData={messageId:m.id,phase:i*2.1,baseY:waterY+.34};
        group.add(bottle);bottles.push(bottle);
      });
    }
    function update(time,lighting){
      const lamps=lighting?lighting.lamps:0;
      rollMat.emissiveIntensity=.22+lamps*1.7;
      glassMat.opacity=.72-lamps*.18;
      for(const b of bottles){const u=b.userData;
        b.position.y=u.baseY+Math.sin(time*.9+u.phase)*.14;
        b.rotation.y+=.0016;b.rotation.x=Math.sin(time*.6+u.phase)*.06;
      }
    }
    function getInfo(){return{count:bottles.length,cap:MAX_BOTTLES,waterY:+waterY.toFixed(2),positions:bottles.map(b=>({id:b.userData.messageId,x:+b.position.x.toFixed(1),y:+b.position.y.toFixed(1),z:+b.position.z.toFixed(1)}))};}
    function dispose(){if(group.parent)group.parent.remove(group);group.clear();bodyGeo.dispose();neckGeo.dispose();corkGeo.dispose();rollGeo.dispose();hitGeo.dispose();glassMat.dispose();rollMat.dispose();corkMat.dispose();hitMat.dispose();bottles=[];}
    return{group,update,dispose,getInfo,setMessages};
  }
  return{create,MAX_BOTTLES};
});
