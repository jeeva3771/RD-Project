// constants for Standalone Enquiry Flow
export const SCOPES = [
  { v: 'local', icon: '🏙️', t: 'Local delivery', sub: 'Within Mumbai / MMR', transit: 0, carriers: ['Our vehicle', 'Hand delivery', 'Porter'] },
  { v: 'state', icon: '🛣️', t: 'Outstation, Maharashtra', sub: 'Pune, Nashik, Nagpur…', transit: 2, carriers: ['Tempo', 'Courier', 'Our vehicle'] },
  { v: 'domestic', icon: '🇮🇳', t: 'Other city or state', sub: 'Anywhere else in India', transit: 4, carriers: ['Courier', 'Air cargo', 'Tempo'] },
  { v: 'intl', icon: '🌍', t: 'International', sub: 'Another country', transit: 7, carriers: ['Air cargo', 'Courier'] }
];

export const HUE = { ind:['var(--indigo-soft)','var(--indigo-ink)'], mint:['var(--mint-soft)','var(--mint-ink)'], gold:['var(--gold-soft)','var(--gold-ink)'], coral:['var(--coral-soft)','var(--coral-ink)'] };

export const MATERIALS = { 'Acrylic': 95, 'Crystal': 290, 'Resin': 110, '3D printing': 140, 'Brass': 165, 'MS': 85, 'Metal': 120, 'Aluminium': 105, 'Glass': 150, 'MDF': 65, 'Wood': 80 };

export const OUTDOOR = ['Football', 'Hockey', 'Kabaddi', 'Kho-kho', 'Athletics & marathon', 'Tennis', 'Golf', 'Volleyball'];
export const INDOOR = ['Badminton', 'Table tennis', 'Chess', 'Carrom', 'Snooker & pool', 'Squash', 'Bowling'];
const sportOpts = (list) => list.map((x) => ({ value: `${x} themed trophy`, label: x }));

export const TYPE_GROUPS = [
  { name: 'Classic', icon: '🏆', items: ['Trophy', 'Plaque', 'Medal', 'Frame', 'Lapel pin', 'Badge', 'Cufflinks', 'Tie pin', 'Fridge magnet', 'Memento', 'Cup', 'Shield', 'Corporate gift'] },
  { name: 'Themed trophies', icon: '🎨', items: ['Location theme trophy', 'Logo themed trophy', 'Product replica trophy', 'Milestone number trophy', 'Brand mascot trophy', 'Photo frame trophy'] },
  { name: 'Sports · outdoor', icon: '🏏', items: [{ value: 'Cricket themed trophy', label: 'Cricket' }, ...sportOpts(OUTDOOR)] },
  { name: 'Sports · indoor', icon: '🏸', items: sportOpts(INDOOR) }
];

export const OCC_GROUPS = [
  { name: 'Corporate', icon: '🏢', items: ['Annual awards', 'Sales contest', 'Rewards & recognition', 'Dealer / channel meet', 'Conference', 'Product launch', 'Leadership offsite', 'Safety award', 'CSR recognition', 'Retirement', 'Farewell'] },
  { name: 'Milestones', icon: '🎯', items: ['Long service (5 / 10 / 25 yrs)', 'Company anniversary', 'Sales milestone', 'Branch / store opening', 'Project completion', 'Customer milestone', 'Record achievement'] },
  { name: 'Fun awards', icon: '🎉', items: ['Early bird', 'Team spirit', 'Most improved', 'Best dressed', 'Coffee champion', 'Problem solver', 'Unsung hero', 'Spark plug', 'Chatterbox', 'Night owl'] },
  { name: 'Sports & events', icon: '🏅', items: ['Sports day', 'Inter-office tournament', 'Marathon / run', 'Annual day', 'College fest', 'School prize day'] },
  { name: 'Festivals & days', icon: '🪔', items: ['Diwali', 'Eid', 'Christmas', 'New Year', 'Independence Day', 'Republic Day', "Women's Day", "Teachers' Day", "Doctors' Day", "Engineers' Day", "Children's Day", "Mother's / Father's Day", 'Wedding & anniversary', 'Birthday', 'Graduation'] }
];

export const ORIGINS = ['WhatsApp', 'Email', 'Call', 'Walk-in', 'Referral', 'Website', 'IndiaMART'];
export const COORDS = ['Priya Nair', 'Meera Joshi', 'Sana Shaikh'];
export const ME = 'Meera Joshi'; // Demo current user

export const CONSTRUCTIONS = [
  { v: '13x11 CNC', icon: '🔲', t: '13x11 CNC' },
  { v: 'CNC with a solid base', icon: '🧱', t: 'CNC with a solid base' },
  { v: 'Plaque with a stud', icon: '📍', t: 'Plaque with a stud' },
  { v: 'Composite with a solid base', icon: '🏛️', t: 'Composite, solid base' },
  { v: 'Composite with single step', icon: '🪜', t: 'Composite, single step' },
  { v: 'Composite with double step', icon: '🪜', t: 'Composite, double step' },
  { v: 'Self-standing block', icon: '🧊', t: 'Self-standing block' },
  { v: 'Fibre frame', icon: '🖼️', t: 'Fibre frame' },
  { v: 'Medal', icon: '🥇', t: 'Medal' },
  { v: 'Clear acrylic with hollow LED base', icon: '💡', t: 'Clear acrylic, hollow LED base' },
  { v: '3D figurine with solid base', icon: '🗿', t: '3D figurine, solid base' }
];

export const ELEMENTS = [
  { v: 'Metal elements', icon: '⚙️', t: 'Metal elements' },
  { v: 'Metal laser-cut elements', icon: '✂️', t: 'Metal laser-cut elements' },
  { v: 'Metal casting elements', icon: '🔥', t: 'Metal casting elements' },
  { v: 'Gold / silver plated elements', icon: '✨', t: 'Gold / silver plated' },
  { v: 'Lanyard', icon: '🎗️', t: 'Lanyard' }
];

export const BUCKETS = [
  { k: 'enquiry', t: 'Enquiry', icon: '📝', c: 'var(--indigo)' },
  { k: 'sdtp', t: 'Sample DTP', icon: '🖋️', c: 'var(--gold)' },
  { k: 'sampling', t: 'Sampling', icon: '🧪', c: 'var(--gold)' },
  { k: 'sappr', t: 'Sample approved', icon: '✅', c: 'var(--mint)' },
  { k: 'packq', t: 'Production order · packing', icon: '📦', c: 'var(--mint)' },
  { k: 'push', t: 'Dispatch · push to production', icon: '🏭', c: 'var(--coral)' },
  { k: 'pdtp', t: 'Production DTP', icon: '🖨️', c: 'var(--mint)' },
  { k: 'content', t: 'Awaiting content list', icon: '📝', c: 'var(--coral)' },
  { k: 'plist', t: 'Awaiting packing list', icon: '📋', c: 'var(--coral)' },
  { k: 'pay', t: 'Awaiting advance', icon: '💳', c: 'var(--coral)' },
  { k: 'dispatchq', t: 'Goods out (to dispatch)', icon: '🚚', c: '#0EA5E9' },
  { k: 'today', t: 'Ready for delivery today', icon: '📅', c: 'var(--indigo)' },
  { k: 'packed', t: 'Packed, not picked', icon: '📦', c: 'var(--coral)' },
  { k: 'aftersales', t: 'After-sales', icon: '🛎️', c: '#0EA5E9' },
  { k: 'collections', t: 'Collections', icon: '💰', c: '#D97706' },
  { k: 'reviews', t: 'Positive reviews', icon: '⭐', c: 'var(--gold)' },
  { k: 'md', t: 'Awaiting MD approval', icon: '🛡️', c: 'var(--coral)' },
  { k: 'cancelled', t: 'Cancelled orders', icon: '✕', c: '#6B7280' }
];

export const TYPE_CATEGORIES = {
  classic: { label: 'Classic', icon: '🏆', count: 13, items: ['Trophy', 'Plaque', 'Medal', 'Frame', 'Lapel pin', 'Badge', 'Cufflinks', 'Tie pin', 'Fridge magnet', 'Memento', 'Cup', 'Shield', 'Corporate gift'], options: ['Trophy', 'Plaque', 'Medal', 'Frame', 'Lapel pin', 'Badge', 'Cufflinks', 'Tie pin', 'Fridge magnet', 'Memento', 'Cup', 'Shield', 'Corporate gift'] },
  themed: { label: 'Themed', icon: '🎨', count: 6, items: ['Location theme trophy', 'Logo themed trophy', 'Product replica trophy', 'Milestone number trophy', 'Brand mascot trophy', 'Photo frame trophy'], options: ['Location theme trophy', 'Logo themed trophy', 'Product replica trophy', 'Milestone number trophy', 'Brand mascot trophy', 'Photo frame trophy'] },
  outdoor: { label: 'Outdoor sports', icon: '🏏', count: 8, items: ['Cricket themed trophy', 'Football themed trophy', 'Hockey themed trophy', 'Kabaddi themed trophy', 'Kho-kho themed trophy', 'Athletics & marathon themed trophy', 'Tennis themed trophy', 'Golf themed trophy'], options: ['Cricket themed trophy', 'Football themed trophy', 'Hockey themed trophy', 'Kabaddi themed trophy', 'Kho-kho themed trophy', 'Athletics & marathon themed trophy', 'Tennis themed trophy', 'Golf themed trophy'] },
  indoor: { label: 'Indoor sports', icon: '🏸', count: 7, items: ['Badminton themed trophy', 'Table tennis themed trophy', 'Chess themed trophy', 'Carrom themed trophy', 'Snooker & pool themed trophy', 'Squash themed trophy', 'Bowling themed trophy'], options: ['Badminton themed trophy', 'Table tennis themed trophy', 'Chess themed trophy', 'Carrom themed trophy', 'Snooker & pool themed trophy', 'Squash themed trophy', 'Bowling themed trophy'] }
};

export const READY_TROPHIES = [
  {
    code: 'RT-101',
    name: 'Victory Cup, gold',
    icon: '🏆',
    rate: 650,
    sizes: [
      { size: 8, rate: 650, stock: 50 },
      { size: 10, rate: 850, stock: 35 },
      { size: 12, rate: 1100, stock: 20 }
    ]
  },
  {
    code: 'RT-205',
    name: 'Star Crystal Trophy',
    icon: '💎',
    rate: 1100,
    sizes: [
      { size: 7, rate: 1100, stock: 45 },
      { size: 9, rate: 1400, stock: 120 },
      { size: 11, rate: 1750, stock: 30 }
    ]
  },
  {
    code: 'RT-310',
    name: 'Classic Wooden Plaque',
    icon: '🪵',
    rate: 420,
    sizes: [
      { size: 6, rate: 420, stock: 100 },
      { size: 8, rate: 580, stock: 65 },
      { size: 10, rate: 750, stock: 40 }
    ]
  },
  {
    code: 'RT-412',
    name: 'Medal with ribbon',
    icon: '🥇',
    rate: 120,
    sizes: [
      { size: 2.5, rate: 120, stock: 500 },
      { size: 3, rate: 160, stock: 300 }
    ]
  },
  {
    code: 'RT-508',
    name: 'Cricket Bat Trophy',
    icon: '🏏',
    rate: 780,
    sizes: [
      { size: 8, rate: 780, stock: 75 },
      { size: 10, rate: 980, stock: 40 }
    ]
  },
  {
    code: 'RT-615',
    name: 'Football Boot Trophy',
    icon: '⚽',
    rate: 690,
    sizes: [
      { size: 7, rate: 690, stock: 60 },
      { size: 9, rate: 890, stock: 30 }
    ]
  },
  {
    code: 'RT-720',
    name: 'Acrylic Star Award',
    icon: '⭐',
    rate: 540,
    sizes: [
      { size: 6, rate: 540, stock: 90 },
      { size: 8, rate: 720, stock: 110 },
      { size: 10, rate: 950, stock: 25 }
    ]
  },
  {
    code: 'RT-830',
    name: 'Golden Oscar-style Figure',
    icon: '🎬',
    rate: 890,
    sizes: [
      { size: 8, rate: 890, stock: 40 },
      { size: 10, rate: 1200, stock: 20 }
    ]
  }
];

export const PERSONALISATION_OPTIONS = [
  { id: 'none', label: 'No personalisation', extra: 0 },
  { id: 'sticker', label: 'Printed sticker', extra: 30 },
  { id: 'metal_plate', label: 'Engraved metal plate', extra: 60 },
  { id: 'uv_print', label: 'Direct UV print', extra: 90 }
];
