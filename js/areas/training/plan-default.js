// Startstand aus Notion (Trainingsplan), übernommen aus hybrid-training@90dc751.
export const CATS={push:'Push',pull:'Pull',sch:'Schultern',quad:'Quads',hk:'Hintere Kette',ws:'Unterschenkel',core:'Core',ath:'Athletik',prep:'Prep'};
export const WU_L=['Knee-to-Wall Ankle Rocks · 45 s/Seite','World’s Greatest Stretch · 45 s/Seite','ATG Split Squat · 30 s/Seite','Leg Swings · 30 s/Seite','Dynamic Deep Squats · 60 s','Single-Leg Glute Bridges · 10×/Seite'];
export const WU_U=['Band Dislocates · 15×','Scapula Pull-Ups · 10×','Scapula Push-Ups · 10×','1 leichter Satz der ersten Übung'];
export const E=(id,name,cat,sets,min,max,o={})=>({id,name,cat,sets,min,max,unit:o.unit||'reps',load:o.load||'',per:o.per||'',eq:o.eq||'',note:o.note||'',rest:o.rest||null});
export const DEF={v:1,days:[
{id:'mo',name:'Lower A',type:'kraft',meta:'~60 min + 15 min Mobility',warm:WU_L,mob:'Mobility Lower · 15 min',blocks:[
 {label:'A',kind:'super',rest:75,ex:[E('pistol','Pistol Squats','quad',3,5,8,{load:'kg',per:'/Seite',eq:'Weight Vest',note:'Volle Tiefe, barfuß stabiler'}),E('nordic','Nordics','hk',3,4,6,{eq:'Sofa / Band',note:'Fersen fixieren, 3–5 s runter'})]},
 {label:'B',kind:'super',rest:75,ex:[E('rdl','Romanian Deadlift','hk',3,8,12,{load:'kg',eq:'Dumbbells',note:'Ersetzt Langhantel-Deadlift'}),E('revnordic','Reverse Nordics','quad',3,8,12,{eq:'Matte',note:'Hüfte gestreckt'})]},
 {label:'C',kind:'circuit',rest:60,ex:[E('slcalf','Single Leg Calf Raises','ws',3,12,20,{per:'/Seite',eq:'Stufe',note:'Barfuß an der Stufenkante'}),E('tib','Tibialis Raises','ws',2,15,20,{eq:'Wand'}),E('copen','Copenhagen Planks','core',3,30,30,{unit:'sec',per:'/Seite',eq:'Bank',note:'Schutz für Sprints'}),E('hlr','Hängendes Beinheben','core',3,10,15,{eq:'Klimmzugstange',note:'Ohne Schwung'})]}]},
{id:'di',name:'Upper A',type:'kraft',meta:'~60 min + 15 min Mobility',warm:[...WU_U,'Band Pull-Aparts · 2 × 15'],mob:'Mobility Upper · 15 min',blocks:[
 {label:'A',kind:'super',rest:75,ex:[E('wpush','Weighted Push-Ups','push',3,6,10,{load:'kg',eq:'Weight Vest'}),E('wpullw','Wide Weighted Pull-Ups','pull',3,6,10,{load:'kg',eq:'Weight Vest',note:'Weste einfach anlassen'})]},
 {label:'B',kind:'super',rest:75,ex:[E('hspu','Handstand Push-Ups','sch',3,5,8,{eq:'Wand',note:'Pike → Wand → Weste'}),E('rrown','Narrow Ring Rows','pull',3,10,15,{eq:'Rings',note:'Füße höher = schwerer'})]},
 {label:'C',kind:'circuit',rest:60,ex:[E('rfly','Ring Flys','push',3,10,15,{eq:'Rings'}),E('latr','Lateral Raises','sch',3,12,20,{load:'kg',eq:'Dumbbell'}),E('triext','Triceps Extensions','push',3,10,15,{eq:'Rings'}),E('curl','Curls','pull',3,10,15,{load:'kg',eq:'Dumbbell'})]}]},
{id:'mi',name:'Joggen',type:'cardio',meta:'Zone 2 · 30 min + Mobility · Strava trackt mit',warm:[],mob:'Mobility Lower · 15 min',blocks:[
 {label:'Warm-up',kind:'single',rest:0,ex:[E('rope','Seilspringen','prep',1,5,5,{unit:'min',eq:'Springseil'})]},
 {label:'Lauf',kind:'single',rest:0,ex:[E('jog','Joggen · Zone 2','ath',1,30,30,{unit:'min',load:'km',eq:'Laufschuhe',note:'Reden muss gehen · ca. 120–140 Puls · ohne Musik'})]}]},
{id:'do',name:'Lower B',type:'kraft',meta:'~60 min + 15 min Mobility',warm:WU_L,mob:'Mobility Lower · 15 min',blocks:[
 {label:'A',kind:'super',rest:75,ex:[E('slrdl','Einbeinige RDLs','hk',3,8,10,{load:'kg',per:'/Seite',eq:'Dumbbell',note:'Hüfte gerade'}),E('stepup','Step-Ups','quad',3,8,12,{load:'kg',per:'/Seite',eq:'Weight Vest + Bank',note:'Langsam runter'})]},
 {label:'B',kind:'super',rest:75,ex:[E('hipthr','Hip Thrust','hk',3,8,12,{load:'kg',eq:'Bank + Dumbbell',note:'1 s oben halten'}),E('nordic','Nordics','hk',2,3,5,{eq:'Sofa / Band',note:'Leicht, Sa ist Sprint-Tag'})]},
 {label:'C',kind:'circuit',rest:60,ex:[E('revnordic','Reverse Nordics','quad',2,8,12,{eq:'Matte'}),E('slcalf','Single Leg Calf Raises','ws',3,12,20,{per:'/Seite',eq:'Stufe'}),E('rollout','Ring Rollouts','core',3,8,12,{eq:'Rings',note:'Kein Hohlkreuz'}),E('lsit','L-Sit','core',3,15,30,{unit:'sec',eq:'Parallettes'})]}]},
{id:'fr',name:'Upper B',type:'kraft',meta:'~60 min + 15 min Mobility',warm:[...WU_U,'Außenrotation Band · 2 × 12–15'],mob:'Mobility Upper · 15 min',blocks:[
 {label:'A',kind:'super',rest:75,ex:[E('wpullc','Close Weighted Pull-Ups','pull',3,5,8,{load:'kg',eq:'Weight Vest'}),E('dips','Brust Dips','push',3,8,12,{load:'kg',eq:'Rings + Vest',note:'Weste anlassen · leicht nach vorne'})]},
 {label:'B',kind:'super',rest:75,ex:[E('incdb','Schrägbankdrücken','push',3,6,10,{load:'kg',eq:'Dumbbells + Bank'}),E('rroww','Wide Ring Rows','pull',3,10,15,{eq:'Rings'})]},
 {label:'C',kind:'circuit',rest:60,ex:[E('latb','Einarmiges Seitheben','sch',3,12,20,{per:'/Seite',eq:'Band'}),E('facep','Face Pulls','sch',3,12,20,{eq:'Band'}),E('ohtri','Overhead Trizeps','push',3,10,15,{eq:'Rings'}),E('curl','Curls','pull',3,10,15,{load:'kg',eq:'Dumbbells'})]}]},
{id:'sa',name:'Athlete Day',type:'athletik',meta:'Power · Sprints · Agility · je 20 min',warm:WU_L,mob:'Mobility Lower · 20 min',blocks:[
 {label:'Power & Plyos',kind:'single',rest:150,ex:[E('boxj','Box Jumps','ath',4,4,4,{eq:'Box',note:'Weich landen'}),E('broadj','Broad Jumps','ath',4,3,3),E('pogo','Pogo Hops','ath',3,20,20),E('explpu','Explosive Pull-Ups','ath',3,5,5,{eq:'Rings / Stange'}),E('clappu','Clap Push-Ups','ath',3,5,5)]},
 {label:'Sprints',kind:'single',rest:60,ex:[E('spr10','Sprints 10 m','ath',4,0,0,{unit:'check',note:'Verschiedene Starts · mit Schuhen'}),E('spr30','Sprints 30 m','ath',5,0,0,{unit:'check',rest:180}),E('sled','Schlitten-Sprint 15 m','ath',4,0,0,{unit:'check',load:'kg',eq:'Schlitten',rest:120})]},
 {label:'Agility',kind:'single',rest:75,ex:[E('5105','5-10-5 Shuttle','ath',4,0,0,{unit:'check',eq:'Cones',note:'Tief bleiben'}),E('tdrill','T-Drill','ath',3,0,0,{unit:'check',eq:'Cones'}),E('shuf','Shuffle + Sprint 5 m','ath',3,0,0,{unit:'check',eq:'Cones'}),E('react','Reaktions-Start','ath',4,0,0,{unit:'check',note:'Partner oder Signal'})]}]},
{id:'so',name:'Ruhetag',type:'ruhe',meta:'Kein Training · gehört zum Plan',warm:[],mob:'Mobility Upper · 15 min',blocks:[]}
]};
export const UNIT={reps:'Wdh',sec:'s',min:'min',check:''};
export const CHECKQ=[['schlaf','Schlaf'],['energie','Energie'],['gelenke','Gelenke'],['ziel','Fortschritt zum Ziel']];
