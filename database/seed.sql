-- Sample flats & rooms (replace with real hostel data). Safe to re-run.
INSERT INTO flats (block_name, flat_number, floor_number, total_rooms, balcony_available, balcony_direction, kitchen, bathroom_type, bathroom_details, facilities, description) VALUES
('A','A-204',2,3,TRUE,'East','Shared','Common','Two common bathrooms shared by the flat',ARRAY['Wi-Fi','Study table','Wardrobe'],'Bright east-facing flat near the stairs.'),
('A','A-301',3,2,FALSE,NULL,'None','Attached','Each room has an attached bathroom',ARRAY['Wi-Fi','Study table','Geyser'],'Quiet top-floor flat.'),
('B','B-102',1,3,TRUE,'West','Shared','Mixed','One attached, one common bathroom',ARRAY['Wi-Fi','Wardrobe','Ceiling fan'],'Ground-adjacent flat close to the games room.'),
('B','B-210',2,2,TRUE,'North','Private','Attached','Attached bathrooms in both rooms',ARRAY['Wi-Fi','Study table','Geyser','Fridge'],'Corner flat with private kitchen.')
ON CONFLICT (block_name, flat_number) DO NOTHING;

INSERT INTO rooms (flat_id, room_number, room_type, capacity, available_beds, window_direction, attached_bathroom, facilities, semester, description)
SELECT f.id, r.room_number, r.room_type, r.capacity, r.capacity, r.win, r.att, r.fac, 'Spring 2027', r.descr
FROM flats f JOIN (VALUES
 ('A-204','201','Triple',3,'East',FALSE,ARRAY['Study table','Wardrobe'],'Faces the courtyard.'),
 ('A-204','202','Double',2,'North',FALSE,ARRAY['Study table'],'Quiet room.'),
 ('A-204','203','Double',2,'East',FALSE,ARRAY['Study table','Wardrobe'],'Next to balcony.'),
 ('A-301','301','Double',2,'South',TRUE,ARRAY['Study table','Geyser'],'Attached bathroom.'),
 ('A-301','302','Single',1,'West',TRUE,ARRAY['Study table','Geyser'],'Single occupancy.'),
 ('B-102','101','Triple',3,'West',FALSE,ARRAY['Wardrobe'],'Spacious.'),
 ('B-102','102','Double',2,'South',TRUE,ARRAY['Wardrobe','Study table'],'Attached bathroom.'),
 ('B-102','103','Double',2,'West',FALSE,ARRAY['Study table'],'Balcony access.'),
 ('B-210','211','Double',2,'North',TRUE,ARRAY['Study table','Geyser'],'Quiet.'),
 ('B-210','212','Double',2,'North',TRUE,ARRAY['Study table','Geyser','Fridge'],'Near kitchen.')
) AS r(flat_number, room_number, room_type, capacity, win, att, fac, descr) ON r.flat_number = f.flat_number
ON CONFLICT (flat_id, room_number, semester) DO NOTHING;
