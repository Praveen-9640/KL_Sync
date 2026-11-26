/** Fields safe to show other students. Contact details only if the owner opted in. */
const publicUser = (u) => ({
  id: u.id, full_name: u.full_name, college: u.college, department: u.department, academic_year: u.academic_year,
  hostel_block: u.hostel_block, skills: u.skills, interests: u.interests,
  email: u.show_email ? u.email : null, phone: u.show_phone ? u.phone : null,
});
const SELF_COLS = 'id,full_name,student_id,email,phone,college,department,academic_year,hostel_name,hostel_block,flat_number,room_number,skills,interests,role,theme,show_email,show_phone,created_at';
module.exports = { publicUser, SELF_COLS };
