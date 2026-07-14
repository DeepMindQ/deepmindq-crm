import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════
   Timezone Mapping — location string → UTC offset in hours
   ═══════════════════════════════════════════════════════════════ */
const TIMEZONE_MAP: [RegExp, number][] = [
  [/india|bangalore|mumbai|delhi|kolkata|chennai|hyderabad/i, 5.5],
  [/uk|london|united\s*kingdom|england|scotland|wales|belfast/i, 0],
  [/usa|new\s*york|boston|philadelphia|washington|atlanta|miami|detroit|chicago/i, -5],
  [/germany|berlin|munich|frankfurt|hamburg|cologne/i, 1],
  [/france|paris|lyon|marseille|nice|toulouse/i, 1],
  [/singapore/i, 8],
  [/china|beijing|shanghai|shenzhen|guangzhou|chengdu|hangzhou/i, 8],
  [/japan|tokyo|osaka|kyoto|yokohama/i, 9],
  [/australia|sydney|melbourne|brisbane|perth|adelaide/i, 10],
  [/dubai|uae|qatar|riyadh|saudi/i, 4],
  [/brazil|são\s*paulo|rio\s*de\s*janeiro/i, -3],
  [/netherlands|amsterdam|rotterdam|the\s*hague/i, 1],
  [/spain|madrid|barcelona|valencia|seville/i, 1],
  [/italy|rome|milan|turin|naples|florence/i, 1],
  [/sweden|stockholm|gothenburg|malmö/i, 1],
  [/norway|oslo|bergen|stavanger/i, 1],
  [/denmark|copenhagen|aarhus|odense/i, 1],
  [/switzerland|zurich|geneva|basel|bern/i, 1],
  [/canada|toronto|ottawa|montreal|vancouver/i, -5],
  [/mexico|mexico\s*city|monterrey|guadalajara/i, -6],
  [/argentina|buenos\s*aires/i, -3],
  [/colombia|bogota|medellín/i, -5],
  [/south\s*korea|seoul|busan|incheon/i, 9],
  [/hong\s*kong/i, 8],
  [/taiwan|taipei/i, 8],
  [/thailand|bangkok/i, 7],
  [/vietnam|ho\s*chi\s*minh|hanoi|danang/i, 7],
  [/indonesia|jakarta|bali|surabaya/i, 7],
  [/philippines|manila/i, 8],
  [/malaysia|kuala\s*lumpur/i, 8],
  [/israel|tel\s*aviv|jerusalem/i, 2],
  [/south\s*africa|johannesburg|cape\s*town|durban/i, 2],
  [/nigeria|lagos|abuja/i, 1],
  [/kenya|nairobi/i, 3],
  [/u\.s\.|united\s*states/i, -5],
  [/pacific|pst|pdt/i, -8],
  [/mountain|mst|mdt/i, -7],
  [/central|cst|cdt/i, -6],
  [/eastern|est|edt/i, -5],
];

const DEFAULT_OFFSET = -5; // EST

function getTimezoneOffset(location: string | null | undefined): number {
  if (!location) return DEFAULT_OFFSET;
  for (const [pattern, offset] of TIMEZONE_MAP) {
    if (pattern.test(location)) return offset;
  }
  return DEFAULT_OFFSET;
}

/* ═══════════════════════════════════════════════════════════════
   Calculate next optimal send slot
   Optimal: Tue–Thu, 9:00–11:00 AM in contact's timezone
   ═══════════════════════════════════════════════════════════════ */
function getNextOptimalSlot(tzOffsetHours: number): { day: string; time: string; iso: string } {
  const now = new Date();

  // Convert now to the contact's local time
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const contactLocalMs = utcMs + tzOffsetHours * 3600000;
  const contactLocal = new Date(contactLocalMs);

  // Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Optimal: Tue(2), Wed(3), Thu(4)
  const optimalDays = [2, 3, 4]; // Tue, Wed, Thu
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Start checking from today
  let candidate = new Date(contactLocal.getFullYear(), contactLocal.getMonth(), contactLocal.getDate(), 9, 0, 0, 0);

  // If today's 9 AM has passed, move to the next optimal day
  if (contactLocal.getHours() >= 11 || !optimalDays.includes(candidate.getDay())) {
    // Find the next Tue/Wed/Thu
    let daysAhead = 1;
    while (daysAhead <= 7) {
      const check = new Date(candidate);
      check.setDate(check.getDate() + daysAhead);
      if (optimalDays.includes(check.getDay())) {
        candidate = check;
        break;
      }
      daysAhead++;
    }
    // If today is an optimal day but past 11 AM, we still moved forward
    if (optimalDays.includes(contactLocal.getDay()) && contactLocal.getHours() < 9) {
      // Actually still today is fine
      candidate = new Date(contactLocal.getFullYear(), contactLocal.getMonth(), contactLocal.getDate(), 9, 0, 0, 0);
    }
  }

  // Format time as 9:00 AM
  const hour = candidate.getHours();
  const minute = candidate.getMinutes();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const timeStr = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;

  // Convert candidate back to UTC ISO string
  const candidateUtcMs = candidate.getTime() - tzOffsetHours * 3600000;
  const isoStr = new Date(candidateUtcMs).toISOString();

  return {
    day: dayNames[candidate.getDay()],
    time: timeStr,
    iso: isoStr,
  };
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/leads/schedule-optimal
   ═══════════════════════════════════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactIds } = body;

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contactIds must be a non-empty array of strings' },
        { status: 400 }
      );
    }

    // Limit batch size
    const ids = contactIds.slice(0, 100);

    const contacts = await db.contact.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        rawName: true,
        location: true,
        company: { select: { normalizedName: true } },
      },
    });

    const schedules = contacts.map(contact => {
      const tzOffset = getTimezoneOffset(contact.location);
      const offsetStr = tzOffset >= 0
        ? `+${Math.floor(tzOffset)}:${Math.abs(tzOffset % 1) === 0.5 ? '30' : '00'}`
        : `${Math.floor(tzOffset)}:${Math.abs(tzOffset % 1) === 0.5 ? '30' : '00'}`;

      const slot = getNextOptimalSlot(tzOffset);

      return {
        contactId: contact.id,
        contactName: contact.rawName,
        companyName: contact.company?.normalizedName,
        location: contact.location,
        timezone: `UTC${offsetStr}`,
        optimalDay: slot.day,
        optimalTime: slot.time,
        scheduledAt: slot.iso,
      };
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('[Schedule Optimal API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate optimal send times', schedules: [] },
      { status: 500 }
    );
  }
}