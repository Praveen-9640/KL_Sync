
import { useMemo, useState } from 'react';
import { CalendarDays, Clock, MapPin, Search } from 'lucide-react';
import './events.css';

const venues = [
  'New Seminar Hall',
  'R&D Theater',
  'Sun Flower Hall',
  'Jasmine Hall',
  'Rose Hall',
  'Peacock Hall',
  'SAC Hall',
  'OAT Ground',
  'Cricket Ground',
  'Basketball Courts'
];

const events = [
  {
    id: 1,
    title: 'AI and Machine Learning Seminar',
    description: 'Explore the latest developments in Artificial Intelligence.',
    date: '2026-11-28',
    start: '10:00 AM',
    end: '12:00 PM',
    venue: 'New Seminar Hall',
    category: 'Seminar'
  },
  {
    id: 2,
    title: 'Research and Innovation Meetup',
    description: 'Discover student research and innovative projects.',
    date: '2026-11-28',
    start: '02:00 PM',
    end: '04:00 PM',
    venue: 'R&D Theater',
    category: 'Workshop'
  },
  {
    id: 3,
    title: 'Cultural Club Open Mic',
    description: 'Music, poetry and performances by students.',
    date: '2026-11-29',
    start: '05:00 PM',
    end: '07:00 PM',
    venue: 'Sun Flower Hall',
    category: 'Cultural'
  },
  {
    id: 4,
    title: 'Design Thinking Workshop',
    description: 'Learn creative problem-solving techniques.',
    date: '2026-11-30',
    start: '09:30 AM',
    end: '12:30 PM',
    venue: 'Jasmine Hall',
    category: 'Workshop'
  },
  {
    id: 5,
    title: 'Startup and Entrepreneurship',
    description: 'Learn about startups and entrepreneurship.',
    date: '2026-12-01',
    start: '11:00 AM',
    end: '01:00 PM',
    venue: 'Rose Hall',
    category: 'Seminar'
  },
  {
    id: 6,
    title: 'Sports Fest',
    description: 'Inter-department outdoor sports competitions.',
    date: '2026-12-02',
    start: '08:00 AM',
    end: '05:00 PM',
    venue: 'OAT Ground',
    category: 'Sports'
  },
  {
    id: 7,
    title: 'Cricket Friendly Match',
    description: 'Friendly cricket match between student teams.',
    date: '2026-12-03',
    start: '03:00 PM',
    end: '05:30 PM',
    venue: 'Cricket Ground',
    category: 'Sports'
  },
  {
    id: 8,
    title: 'Basketball Selections',
    description: 'Open basketball team selection and practice.',
    date: '2026-12-04',
    start: '04:00 PM',
    end: '06:00 PM',
    venue: 'Basketball Courts',
    category: 'Sports'
  },
  {
    id: 9,
    title: 'Student Community Meetup',
    description: 'Meet student clubs and connect with classmates.',
    date: '2026-12-05',
    start: '10:00 AM',
    end: '12:00 PM',
    venue: 'Peacock Hall',
    category: 'Community'
  },
  {
    id: 10,
    title: 'Campus Clubs Orientation',
    description: 'Discover university clubs and activities.',
    date: '2026-12-06',
    start: '11:00 AM',
    end: '01:00 PM',
    venue: 'SAC Hall',
    category: 'Community'
  }
];

const indoorVenues = venues.slice(0, 7);

export default function Events() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedVenue, setSelectedVenue] = useState('All Venues');

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch =
        `${event.title} ${event.venue} ${event.description}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesFilter =
        filter === 'All' ||
        (filter === 'Indoor' && indoorVenues.includes(event.venue)) ||
        (filter === 'Outdoor' && !indoorVenues.includes(event.venue));

      const matchesVenue =
        selectedVenue === 'All Venues' ||
        event.venue === selectedVenue;

      return matchesSearch && matchesFilter && matchesVenue;
    }).sort((a, b) =>
      `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)
    );
  }, [search, filter, selectedVenue]);

  return (
    <div className="campus-events">

      <div className="events-hero">
        <span className="events-tag">CAMPUS LIFE</span>
        <h1>Discover Campus Events</h1>
        <p>
          Never miss what's happening around your campus.
          Find events, explore venues and stay updated.
        </p>

        <div className="events-stats">
          <div>
            <h2>{events.length}</h2>
            <span>Demo Events</span>
          </div>
          <div>
            <h2>{venues.length}</h2>
            <span>Venues</span>
          </div>
        </div>
      </div>

      <div className="events-main">

        <div className="events-heading">
          <div>
            <h2>Upcoming Events</h2>
            <p>Find out what's happening around KL University.</p>
          </div>
          <span>{filteredEvents.length} Events Found</span>
        </div>

        <div className="events-filters">
          <div className="events-search">
            <Search size={18} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events or venues..."
            />
          </div>

          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="All">All Locations</option>
            <option value="Indoor">Seminar Halls</option>
            <option value="Outdoor">Outdoor Venues</option>
          </select>

          <select
            value={selectedVenue}
            onChange={e => setSelectedVenue(e.target.value)}
          >
            <option>All Venues</option>
            {venues.map(venue => (
              <option key={venue}>{venue}</option>
            ))}
          </select>
        </div>

        <div className="events-grid">
          {filteredEvents.map(event => (
            <div className="campus-event-card" key={event.id}>

              <div className="event-card-top">
                <span className="event-category">
                  {event.category}
                </span>
                <CalendarDays size={19} />
              </div>

              <h3>{event.title}</h3>
              <p className="event-description">
                {event.description}
              </p>

              <div className="event-info">
                <div>
                  <CalendarDays size={17} />
                  {new Date(event.date + 'T00:00:00').toLocaleDateString(
                    'en-IN',
                    { day: 'numeric', month: 'short', year: 'numeric' }
                  )}
                </div>

                <div>
                  <Clock size={17} />
                  {event.start} – {event.end}
                </div>

                <div>
                  <MapPin size={17} />
                  {event.venue}
                </div>
              </div>

            </div>
          ))}
        </div>

        {filteredEvents.length === 0 && (
          <div className="events-no-results">
            <h3>No events found</h3>
            <p>Try searching for another event or venue.</p>
          </div>
        )}

        <p className="events-demo-warning">
          These are sample events for frontend testing.
          They are not confirmed university announcements.
        </p>

      </div>
    </div>
  );
}
