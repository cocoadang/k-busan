const rows = [
  { name: '36A', total: 90, member: 0, reserved: 0, general: 0, rental: 90, orig: { member: '-', reserved: '-', general: '-', rental: '90세대' } },
  { name: '36B', total: 90, member: 0, reserved: 0, general: 0, rental: 90, orig: { member: '-', reserved: '-', general: '-', rental: '90세대' } },
  { name: '59A', total: 174, member: 25, reserved: 2, general: 147, rental: 0, orig: { member: '25세대', reserved: '2세대', general: '147세대', rental: '-' } },
  { name: '59B', total: 300, member: 2, reserved: 2, general: 296, rental: 0, orig: { member: '2세대', reserved: '2세대', general: '296세대', rental: '-' } },
  { name: '59C', total: 197, member: 4, reserved: 1, general: 192, rental: 0, orig: { member: '4세대', reserved: '1세대', general: '192세대', rental: '-' } },
  { name: '59D', total: 46, member: 3, reserved: 1, general: 42, rental: 0, orig: { member: '3세대', reserved: '1세대', general: '42세대', rental: '-' } },
  { name: '59E', total: 114, member: 2, reserved: 2, general: 110, rental: 0, orig: { member: '2세대', reserved: '2세대', general: '110세대', rental: '-' } },
  { name: '59F', total: 125, member: 1, reserved: 2, general: 122, rental: 0, orig: { member: '1세대', reserved: '2세대', general: '122세대', rental: '-' } },
  { name: '69W', total: 9, member: 0, reserved: 0, general: 9, rental: 0, orig: { member: '-', reserved: '-', general: '9세대', rental: '-' } },
  { name: '69X', total: 9, member: 0, reserved: 0, general: 9, rental: 0, orig: { member: '-', reserved: '-', general: '9세대', rental: '-' } },
  { name: '69Y', total: 18, member: 0, reserved: 0, general: 18, rental: 0, orig: { member: '-', reserved: '-', general: '18세대', rental: '-' } },
  { name: '72B', total: 64, member: 0, reserved: 0, general: 64, rental: 0, orig: { member: '-', reserved: '-', general: '64세대', rental: '-' } },
  { name: '74A', total: 10, member: 2, reserved: 0, general: 8, rental: 0, orig: { member: '2세대', reserved: '-', general: '8세대', rental: '-' } },
  { name: '84A1', total: 232, member: 70, reserved: 3, general: 159, rental: 0, orig: { member: '70세대', reserved: '3세대', general: '159세대', rental: '-' } },
  { name: '84A2', total: 30, member: 15, reserved: 0, general: 15, rental: 0, orig: { member: '15세대', reserved: '-', general: '15세대', rental: '-' } },
  { name: '84B', total: 148, member: 37, reserved: 3, general: 108, rental: 0, orig: { member: '37세대', reserved: '3세대', general: '108세대', rental: '-' } },
  { name: '84C', total: 275, member: 255, reserved: 0, general: 20, rental: 0, orig: { member: '255세대', reserved: '-', general: '20세대', rental: '-' } },
  { name: '84D', total: 316, member: 290, reserved: 0, general: 26, rental: 0, orig: { member: '290세대', reserved: '-', general: '26세대', rental: '-' } },
  { name: '84E', total: 40, member: 17, reserved: 1, general: 22, rental: 0, orig: { member: '17세대', reserved: '1세대', general: '22세대', rental: '-' } },
  { name: '84F', total: 128, member: 121, reserved: 0, general: 7, rental: 0, orig: { member: '121세대', reserved: '-', general: '7세대', rental: '-' } },
  { name: '84G', total: 64, member: 60, reserved: 0, general: 4, rental: 0, orig: { member: '60세대', reserved: '-', general: '4세대', rental: '-' } },
  { name: '84H', total: 111, member: 5, reserved: 3, general: 103, rental: 0, orig: { member: '5세대', reserved: '3세대', general: '103세대', rental: '-' } },
  { name: '84T1', total: 20, member: 1, reserved: 0, general: 19, rental: 0, orig: { member: '1세대', reserved: '-', general: '19세대', rental: '-' } },
  { name: '84T2', total: 20, member: 13, reserved: 0, general: 7, rental: 0, orig: { member: '13세대', reserved: '-', general: '7세대', rental: '-' } },
  { name: '90A', total: 43, member: 43, reserved: 0, general: 0, rental: 0, orig: { member: '43세대', reserved: '-', general: '-', rental: '-' } },
  { name: '95W', total: 9, member: 1, reserved: 0, general: 8, rental: 0, orig: { member: '1세대', reserved: '-', general: '8세대', rental: '-' } },
  { name: '95X', total: 45, member: 3, reserved: 0, general: 42, rental: 0, orig: { member: '3세대', reserved: '-', general: '42세대', rental: '-' } },
  { name: '98A1', total: 27, member: 27, reserved: 0, general: 0, rental: 0, orig: { member: '27세대', reserved: '-', general: '-', rental: '-' } },
  { name: '98A2', total: 26, member: 23, reserved: 0, general: 3, rental: 0, orig: { member: '23세대', reserved: '-', general: '3세대', rental: '-' } },
  { name: '98B', total: 148, member: 138, reserved: 0, general: 10, rental: 0, orig: { member: '138세대', reserved: '-', general: '10세대', rental: '-' } },
  { name: '98C', total: 311, member: 287, reserved: 0, general: 24, rental: 0, orig: { member: '287세대', reserved: '-', general: '24세대', rental: '-' } },
  { name: '98D', total: 16, member: 6, reserved: 0, general: 10, rental: 0, orig: { member: '6세대', reserved: '-', general: '10세대', rental: '-' } },
  { name: '98T', total: 8, member: 7, reserved: 0, general: 1, rental: 0, orig: { member: '7세대', reserved: '-', general: '1세대', rental: '-' } },
  { name: '107W', total: 9, member: 8, reserved: 0, general: 1, rental: 0, orig: { member: '8세대', reserved: '-', general: '1세대', rental: '-' } },
  { name: '114A', total: 103, member: 98, reserved: 0, general: 5, rental: 0, orig: { member: '98세대', reserved: '-', general: '5세대', rental: '-' } },
  { name: '114B', total: 96, member: 92, reserved: 0, general: 4, rental: 0, orig: { member: '92세대', reserved: '-', general: '4세대', rental: '-' } },
  { name: '122W', total: 8, member: 7, reserved: 0, general: 1, rental: 0, orig: { member: '7세대', reserved: '-', general: '1세대', rental: '-' } },
  { name: '122X', total: 18, member: 16, reserved: 0, general: 2, rental: 0, orig: { member: '16세대', reserved: '-', general: '2세대', rental: '-' } },
  { name: '124A', total: 43, member: 43, reserved: 0, general: 0, rental: 0, orig: { member: '43세대', reserved: '-', general: '-', rental: '-' } },
  { name: '134PA', total: 4, member: 4, reserved: 0, general: 0, rental: 0, orig: { member: '4세대', reserved: '-', general: '-', rental: '-' } },
  { name: '134PB', total: 1, member: 1, reserved: 0, general: 0, rental: 0, orig: { member: '1세대', reserved: '-', general: '-', rental: '-' } },
];

let mismatches = 0;
for (const r of rows) {
  const sum = r.member + r.reserved + r.general + r.rental;
  if (sum !== r.total) {
    console.error(`MISMATCH in ${r.name}: ${sum} !== ${r.total}`);
    mismatches++;
  }
}
console.log(`타입별 산술 검사 완료 (불일치 건수: ${mismatches})`);

const nonRental = rows.filter(r => r.name !== '36A' && r.name !== '36B');
const rental = rows.filter(r => r.name === '36A' || r.name === '36B');

const sumNR = {
  total: nonRental.reduce((s, r) => s + r.total, 0),
  member: nonRental.reduce((s, r) => s + r.member, 0),
  reserved: nonRental.reduce((s, r) => s + r.reserved, 0),
  general: nonRental.reduce((s, r) => s + r.general, 0),
  rental: nonRental.reduce((s, r) => s + r.rental, 0),
};

const sumR = {
  total: rental.reduce((s, r) => s + r.total, 0),
  member: rental.reduce((s, r) => s + r.member, 0),
  reserved: rental.reduce((s, r) => s + r.reserved, 0),
  general: rental.reduce((s, r) => s + r.general, 0),
  rental: rental.reduce((s, r) => s + r.rental, 0),
};

console.log('비임대 39개 합계:', JSON.stringify(sumNR));
console.log('임대 2개 합계:', JSON.stringify(sumR));
console.log('전체 41개 합계:', JSON.stringify({
  total: sumNR.total + sumR.total,
  member: sumNR.member + sumR.member,
  reserved: sumNR.reserved + sumR.reserved,
  general: sumNR.general + sumR.general,
  rental: sumNR.rental + sumR.rental,
}));
