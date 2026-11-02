// Bảng tier theo đường — nguồn: tierlq.com (Mùa S4 2026 · cập nhật 30/10/2026)
// Định dạng: "Tên:Tier:Điểm" — dấu * ở cuối = đường phụ của tướng đó.
const TIER_SOURCE = {
  name: 'tierlq.com',
  url: 'https://tierlq.com/',
  season: 'Mùa S4 2026 · Bản Vết Nứt Thời Không',
  updated: '30/10/2026',
};

const LANES = [
  { id: 'top', name: 'Tà Thần', short: 'TT', icon: '⚔' },
  { id: 'jg', name: 'Rừng', short: 'R', icon: '🌿' },
  { id: 'mid', name: 'Giữa', short: 'G', icon: '🔮' },
  { id: 'ad', name: 'Rồng', short: 'Rg', icon: '🏹' },
  { id: 'sp', name: 'Trợ thủ', short: 'TrT', icon: '🛡' },
];

const TIER_RAW = {
  top: `Marja:S:5.00|Ryoma:S:4.34|Edras:S:3.93|
Airi:A:4.28|Biron:A:3.72|Qi:A:3.51|Zephys:A:3.67*|Florentino:A:3.25|Maloch:A:3.24|Taara:A:3.08|Skud:A:2.97|Yena:A:2.65|
Billow:B:4.91*|Richter:B:2.94|Omen:B:2.73|Wiro:B:2.85*|Zuka:B:2.41|Volkath:B:2.26|Veres:B:2.03|Yan:B:1.84|Arthur:B:1.80|Errol:B:1.65|
Triệu Vân:C:1.55|Bijan:C:1.55|Lữ Bố:C:1.55|Wonder Woman:C:1.55|Ata:C:1.50|Max:C:1.50|Allain:C:1.50|Bolt Baron:C:1.50|
Kil'Groth:D:1.50|Superman:D:1.50|Amily:D:1.50|Charlotte:D:1.50|Rourke:D:1.50|Dextra:D:1.50|Arduin:D:1.65*|Kaine:D:1.50*`,

  jg: `Billow:S:4.91|Sinestrea:S:4.60|Astrid:S:4.07|Tamyn:S:3.70|
Tachi:A:4.04|Ryoma:A:4.34*|Airi:A:4.28*|Zephys:A:3.67|Qi:A:3.51*|Nakroth:A:2.78|
Butterfly:B:3.32|Murad:B:3.22|Enzo:B:3.12|Keera:B:2.49|Aoi:B:2.25|Zuka:B:2.41*|
Ngộ Không:C:1.55|Paine:C:1.55|Kriknak:C:1.55|Bright:C:1.55|
Zill:D:1.50|Quillen:D:1.50|Kaine:D:1.50|The Flash:D:1.50|Triệu Vân:D:1.55*`,

  mid: `Lorion:S:4.59|Zata:S:4.53|Rouie:S:4.77*|Liliana:S:4.17|Annette:S:4.28*|
Mganga:A:3.18|Iggy:A:2.95|Gildur:A:2.85|Ignis:A:2.81|D'Arcy:A:2.57|Yue:A:2.55|Evita:A:1.86|Preyta:A:1.77|Raz:A:1.55|
Flowborn:B:2.53|Azzen'Ka:B:2.25|Goverra:B:2.15|Aleister:B:2.03|Natalya:B:1.99|Heino:B:1.65|
Krixi:C:1.55|Tulen:C:1.55|Kahlii:C:1.55|Ilumia:C:1.55|Sephera:C:1.55|Jinna:C:1.55|
Veera:D:1.50|Lauriel:D:1.50|Điêu Thuyền:D:1.50|Bonnie:D:1.50|Ishar:D:1.50|Dirak:D:1.50|Zill:D:1.50*`,

  ad: `Eland'orr:S:5.00|Violet:S:4.57|Hayate:S:4.36|
Flowborn:A:4.00|Valhein:A:3.96|Stuart:A:3.87|Capheny:A:3.41|Bolt Baron:A:1.50*|
Wisp:B:3.14|Fennik:B:2.28|Moren:B:1.97|Elsu:B:1.94|Slimz:B:1.65|
Tel'Annas:C:1.65|Thorne:C:1.55|Erin:C:1.55|Laville:C:1.50|Celica:C:1.50|
Yorn:D:1.50|Lindis:D:1.50|Teeri:D:1.50`,

  sp: `Y'bneth:S:5.00|Rouie:S:4.77|Dolia:S:4.54|Annette:S:4.28|
Toro:A:4.20|TeeMee:A:4.06|Thane:A:3.89|Mina:A:3.67|Alice:A:3.22|Cresht:A:2.94|Taara:A:3.08*|Krizzix:A:2.56|
Wiro:B:2.85|Baldum:B:2.48|Dyadia:B:2.41|Aya:B:2.32|Chaugnar:B:2.15|Arthur:B:1.80*|
Zip:C:1.80|Arduin:C:1.65|Grakk:C:1.65|Roxie:C:1.55|Xeniel:C:1.55|Arum:C:1.55|Helen:C:1.55|
Ming:D:1.55|Omega:D:1.55|Ormarr:D:1.50|Lumburr:D:1.50|Ata:D:1.50*`,
};
