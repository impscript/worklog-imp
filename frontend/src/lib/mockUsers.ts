export interface MockHRMSUser {
  emp_id: string;
  full_name: string;
  nickname: string;
  position: string;
  bu_working: string;
  line_of_work: string;
  department: string;
  company_name: string;
  email: string;
  phone?: string;
  level_name?: string;
}

export const MOCK_USERS: MockHRMSUser[] = [
  // 1. Improvement (IMP)
  {
    emp_id: "638089",
    full_name: "จินตนา ภูดิทธนภาคย์",
    nickname: "Suay",
    position: "Head of Operation Process Improvement",
    bu_working: "Others_President Office",
    line_of_work: "Improvement",
    department: "Improvement",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค จำกัด",
    email: "jintana_p@304ip.com",
    phone: "0858350001",
    level_name: "Department Manager"
  },
  // 2. Real Estate - Marketing & Sales
  {
    emp_id: "11602338",
    full_name: "ชาตรี ตามครองชัย",
    nickname: "Chatri",
    position: "Marketing Department Manager",
    bu_working: "Real Estate_COM&RES",
    line_of_work: "Sales & Marketing",
    department: "Marketing Site DAP",
    company_name: "บริษัท มายกรีนวิลเลจ จำกัด",
    email: "chatri_t@mygreen.com",
    phone: "0858350002",
    level_name: "Department Manager"
  },
  {
    emp_id: "541273",
    full_name: "ธนัญชญา เตียวอู๋",
    nickname: "Pui",
    position: "Marketing Department Manager",
    bu_working: "Real Estate_Housing",
    line_of_work: "Project BU 2+3",
    department: "PD3 - Sales&MKT",
    company_name: "บริษัท มายกรีนวิลเลจ จำกัด",
    email: "thananchaya_t@mygreen.com",
    phone: "0858350003",
    level_name: "Department Manager"
  },
  {
    emp_id: "570663",
    full_name: "กิตติคุณ ภัคพยัต",
    nickname: "Arm",
    position: "Senior Marketing Officer",
    bu_working: "Real Estate_Housing",
    line_of_work: "Project BU 4",
    department: "Marketing",
    company_name: "บริษัท มาตา ดีเวลล็อปเมนท์ จำกัด",
    email: "kittikhun_p@mata.com",
    phone: "0858350004",
    level_name: "Senior"
  },
  // 3. Real Estate - Construction & Housing
  {
    emp_id: "548393",
    full_name: "อนุวัตร เซียสกุล",
    nickname: "Wat",
    position: "Project Manager - BU 2",
    bu_working: "Real Estate_Housing",
    line_of_work: "Project BU 2",
    department: "Project Housing ฉะเชิงเทรา",
    company_name: "บริษัท อินเตอร์ไทยคอนสตรัคชั่น จำกัด",
    email: "anuwat_s@interthai.com",
    phone: "0858350005",
    level_name: "Manager"
  },
  {
    emp_id: "16746937",
    full_name: "ราชวัติ แจ้งยะเวช",
    nickname: "Wat_Juridical",
    position: "ผู้จัดการฝ่ายนิติบุคคล",
    bu_working: "Real Estate_Housing",
    line_of_work: "Project BU 3",
    department: "นิติบุคคล",
    company_name: "บริษัท มายกรีนวิลเลจ จำกัด",
    email: "ratchawat_j@mygreen.com",
    phone: "0858350006",
    level_name: "Manager"
  },
  {
    emp_id: "18267585",
    full_name: "ชลธิชา คอนศรีรัมย์",
    nickname: "View",
    position: "เจ้าหน้าที่นิติบุคคล site DAP",
    bu_working: "Real Estate_Housing",
    line_of_work: "Project BU 3",
    department: "นิติบุคคล",
    company_name: "บริษัท มายกรีนวิลเลจ จำกัด",
    email: "chonticha_c@mygreen.com",
    phone: "0858350007",
    level_name: "Officer"
  },
  // 4. Real Estate - Commercial & Residential (COM&RES)
  {
    emp_id: "18448875",
    full_name: "เพ็ญนภา รัตนวิจิตร",
    nickname: "Pen",
    position: "Commercial Network Section Manager",
    bu_working: "Real Estate_COM&RES",
    line_of_work: "Operation",
    department: "Commercial",
    company_name: "บริษัท 304 พลาซ่า จำกัด",
    email: "pennapa_r@304plaza.com",
    phone: "0858350008",
    level_name: "Section Manager"
  },
  {
    emp_id: "18461918",
    full_name: "ยุพา ธูปหอม",
    nickname: "Yu",
    position: "หัวหน้างานบริหารพื้นที่",
    bu_working: "Real Estate_COM&RES",
    line_of_work: "Operation",
    department: "Residential DAP",
    company_name: "บริษัท เอ็มจีที แด๊ป จำกัด",
    email: "yupa_t@mgtdap.com",
    phone: "0858350009",
    level_name: "Supervisor"
  },
  // 5. Industrial Operations
  {
    emp_id: "630293",
    full_name: "สุดารัตน์ สุขสมอารีย์วงศ์",
    nickname: "Su",
    position: "ISO Safety & Risk Management Section Manager (Acting)",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "Industrial - Operation",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค จำกัด",
    email: "sudarat_s@304ip.com",
    phone: "0858350010",
    level_name: "Section Manager"
  },
  {
    emp_id: "660315",
    full_name: "เบญจวรรณ จงหมั่น",
    nickname: "Ben",
    position: "EIA Engineer",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "Environment",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค 7 จำกัด",
    email: "benjawan_j@304ip7.com",
    phone: "0858350011",
    level_name: "Engineer"
  },
  {
    emp_id: "610872",
    full_name: "ศักดิ์ชัย แก้วดา",
    nickname: "Sak",
    position: "Industrial Park Development Department Manager",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "Industrial - Operation",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค จำกัด",
    email: "sakchai_k@304ip.com",
    phone: "0858350012",
    level_name: "Department Manager"
  },
  {
    emp_id: "650052",
    full_name: "ปรัชญ์ สุขสันต์",
    nickname: "Prat",
    position: "Industrial Park Development Section Manager",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "Industrial - Operation",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค จำกัด",
    email: "prat_s@304ip.com",
    phone: "0858350013",
    level_name: "Section Manager"
  },
  {
    emp_id: "650484",
    full_name: "ธัญยาภัคส์ มุสิกุล",
    nickname: "Thanya",
    position: "Industrial Park Development Engineer",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "Industrial - Operation",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค 2 จำกัด",
    email: "thanyapak_m@304ip2.com",
    phone: "0858350014",
    level_name: "Engineer"
  },
  {
    emp_id: "670660",
    full_name: "ศุภกร สุขสำราญ",
    nickname: "Supakorn",
    position: "หัวหน้างานดับเพลิง",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "Industrial - Operation",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค 7 จำกัด",
    email: "supakorn_s@304ip7.com",
    phone: "0858350015",
    level_name: "Supervisor"
  },
  {
    emp_id: "34753",
    full_name: "นิรุตติ์ จีนเจียง",
    nickname: "Nirut",
    position: "หัวหน้ากะ ดับเพลิง",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "Industrial - Operation",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค 7 จำกัด",
    email: "nirut_j@304ip7.com",
    phone: "0858350016",
    level_name: "Shift Leader"
  },
  {
    emp_id: "660641",
    full_name: "สุวิจักขณ์ บุญโจม",
    nickname: "Suwijak",
    position: "Foreman After sales",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "After Sales Service",
    company_name: "บริษัท มายกรีนวิลเลจ จำกัด",
    email: "suwijak_b@mygreen.com",
    phone: "0858350017",
    level_name: "Foreman"
  },
  {
    emp_id: "661093",
    full_name: "ณัฐวุฒิ หัดโท",
    nickname: "Wut",
    position: "Field Project",
    bu_working: "Real Estate_Industrial Park",
    line_of_work: "Industrial - Operation",
    department: "Industrial - Operation",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค จำกัด",
    email: "nattawut_h@304ip.com",
    phone: "0858350018",
    level_name: "Officer"
  },
  // 6. Marine Transport & Logistics
  {
    emp_id: "628229",
    full_name: "ลลิตา มั่งนิมิตร",
    nickname: "Pang",
    position: "เจ้าหน้าที่ศูนย์ควบคุม",
    bu_working: "Marine",
    line_of_work: "Marine Transport + Warehouse",
    department: "Route Management",
    company_name: "บริษัท ฟิวเจอร์ พอร์ท จำกัด",
    email: "lalita_m@futureport.com",
    phone: "0858350019",
    level_name: "Officer"
  },
  {
    emp_id: "688207",
    full_name: "รัชสุดา กันหา",
    nickname: "Soda",
    position: "เจ้าหน้าที่ศูนย์ควบคุมบริหารงานทางน้ำ",
    bu_working: "Marine",
    line_of_work: "Marine Transport + Warehouse",
    department: "Route Management",
    company_name: "บริษัท ทะเลไทย ขนส่ง2 จำกัด",
    email: "ratsuda_k@talaythai.com",
    phone: "0858350020",
    level_name: "Officer"
  },
  {
    emp_id: "648136",
    full_name: "ณัฐเศรษฐ กงใจ",
    nickname: "Ice",
    position: "เจ้าหน้าที่ศูนย์ควบคุม",
    bu_working: "Marine",
    line_of_work: "Marine Transport + Warehouse",
    department: "INTER 3",
    company_name: "บริษัท อินเตอร์ สตีวีโดริ่ง 7 จำกัด",
    email: "nattaseth_k@interstev.com",
    phone: "0858350021",
    level_name: "Officer"
  },
  // 7. HRBP & Corporate HR
  {
    emp_id: "670033",
    full_name: "ยุพเรศ เฉียวกุล",
    nickname: "Yuparet",
    position: "HRBP Department Manager",
    bu_working: "Corporate LO&RE",
    line_of_work: "HR",
    department: "HRBP Real Estate",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค 7 จำกัด",
    email: "yuparet_c@304ip7.com",
    phone: "0858350022",
    level_name: "Department Manager"
  },
  {
    emp_id: "650383",
    full_name: "จุรีรัตน์ มูลเมือง",
    nickname: "Jureerat",
    position: "HRBP Department Manager",
    bu_working: "Corporate DA",
    line_of_work: "HR",
    department: "HRBP",
    company_name: "บริษัท 304 อินดัสเตรียล ปาร์ค จำกัด",
    email: "jureerat_m@304ip.com",
    phone: "0858350023",
    level_name: "Department Manager"
  },
  {
    emp_id: "688166",
    full_name: "พิจิตราภรณ์ เกษมสุข",
    nickname: "Kwang",
    position: "HROD Officer",
    bu_working: "Corporate LO&RE",
    line_of_work: "HR",
    department: "Human Resource",
    company_name: "บริษัท สินสุขใจ จำกัด",
    email: "phijitraphorn_k@sinsukjai.com",
    phone: "0858350024",
    level_name: "Officer"
  },
  {
    emp_id: "668085",
    full_name: "ฐิตาภา ชุ่มใจ",
    nickname: "Ploy",
    position: "HRBP Officer",
    bu_working: "Corporate LO&RE",
    line_of_work: "HR",
    department: "Human Resource",
    company_name: "บริษัท เอ็ม ไอ บี โฮลงดิ้ง จำกัด",
    email: "thitapa_c@mibholding.com",
    phone: "0858350025",
    level_name: "Officer"
  },
  {
    emp_id: "660592",
    full_name: "สุพิชญา เขตตวงษ์",
    nickname: "Ploy_HR",
    position: "HRBP Officer",
    bu_working: "Corporate LO&RE",
    line_of_work: "HR",
    department: "Human Resource",
    company_name: "บริษัท กรีน ซิตี้ อินดัสเตรียลปาร์ค จำกัด",
    email: "supichaya_k@greencity.com",
    phone: "0858350026",
    level_name: "Officer"
  },
  // 8. Accounting & Treasury
  {
    emp_id: "570704",
    full_name: "นิศาชล ศรีวิชัย",
    nickname: "Poy",
    position: "Senior Accounting Officer",
    bu_working: "Corporate LO&RE",
    line_of_work: "Account RE",
    department: "Accounting",
    company_name: "บริษัท มาตา ดีเวลล็อปเมนท์ จำกัด",
    email: "nisachon_s@mata.com",
    phone: "0858350027",
    level_name: "Senior Officer"
  },
  {
    emp_id: "22737756",
    full_name: "ทิษณุ ลีลาวัชรมาศ",
    nickname: "Boy",
    position: "Cockpit Room Section Manager",
    bu_working: "Corporate LO&RE",
    line_of_work: "Cockpit room Center",
    department: "Treasury Center",
    company_name: "บริษัท ไอพี 5 จำกัด",
    email: "thitsanu_l@ip5.com",
    phone: "0858350028",
    level_name: "Section Manager"
  }
];
