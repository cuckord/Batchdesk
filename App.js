import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Linking,
  Alert
} from 'react-native';

const PROJECT_ID = "batchdesk-3009";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/students`;

const ACADEMIC_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Filtering, Search, and Live States
  const [selectedMonth, setSelectedMonth] = useState('Jun');
  const [batchFilter, setBatchFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState(''); // Live search string state
  const [students, setStudents] = useState([]);

  // Form Field Insertion States
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [batch, setBatch] = useState('Morning'); 
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');

  // FETCH MASTER DATA RECOGNITION PIPELINE
  const fetchStudents = async () => {
    try {
      const response = await fetch(BASE_URL);
      const data = await response.json();
      
      if (data.documents) {
        const formatted = data.documents.map(doc => {
          const id = doc.name.split('/').pop();
          const fields = doc.fields || {};

          const historyArray = fields.history?.arrayValue?.values || [];
          const history = historyArray.map(item => {
            const mapFields = item.mapValue?.fields || {};
            return {
              month: mapFields.month?.stringValue || '',
              amount: mapFields.amount?.stringValue || '',
              status: mapFields.status?.stringValue || 'Pending'
            };
          });

          return {
            id,
            name: fields.name?.stringValue || '',
            class: fields.class?.stringValue || '',
            batch: fields.batch?.stringValue || 'Morning',
            phone: fields.phone?.stringValue || '',
            history
          };
        });
        setStudents(formatted);
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.error("REST Fetch error: ", err);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // SUBMIT STUDENT ENTRY
  const handleAddStudent = async () => {
    if (!name.trim() || !amount.trim() || !studentClass.trim() || !phone.trim()) return;

    const docId = name.trim().toLowerCase().replace(/\s+/g, '_');
    const existingStudent = students.find((s) => s.id === docId);

    let finalHistory = [];

    if (existingStudent) {
      const monthExists = existingStudent.history.some((h) => h.month === selectedMonth);
      if (monthExists) return; 
      finalHistory = [
        ...existingStudent.history,
        { month: selectedMonth, amount: amount.trim(), status: 'Pending' }
      ];
    } else {
      finalHistory = [{ month: selectedMonth, amount: amount.trim(), status: 'Pending' }];
    }

    const payload = {
      fields: {
        name: { stringValue: name.trim() },
        class: { stringValue: studentClass.trim() },
        batch: { stringValue: batch },
        phone: { stringValue: phone.trim() },
        history: {
          arrayValue: {
            values: finalHistory.map(h => ({
              mapValue: {
                fields: {
                  month: { stringValue: h.month },
                  amount: { stringValue: h.amount },
                  status: { stringValue: h.status }
                }
              }
            }))
          }
        }
      }
    };

    try {
      await fetch(`${BASE_URL}/${docId}`, {
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setName('');
      setStudentClass('');
      setPhone('');
      setAmount('');
      fetchStudents(); 
    } catch (err) {
      console.error("REST Push error: ", err);
    }
  };

  const createMissingInvoice = async (studentId, defaultAmount) => {
    const target = students.find((s) => s.id === studentId);
    if (!target) return;

    const updatedHistory = [
      ...target.history,
      { month: selectedMonth, amount: defaultAmount || '2000', status: 'Pending' }
    ];

    const payload = {
      fields: {
        name: { stringValue: target.name },
        class: { stringValue: target.class },
        batch: { stringValue: target.batch },
        phone: { stringValue: target.phone },
        history: {
          arrayValue: {
            values: updatedHistory.map(h => ({
              mapValue: {
                fields: {
                  month: { stringValue: h.month },
                  amount: { stringValue: h.amount },
                  status: { stringValue: h.status }
                }
              }
            }))
          }
        }
      }
    };

    try {
      await fetch(`${BASE_URL}/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchStudents();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (studentId) => {
    const target = students.find((s) => s.id === studentId);
    if (!target) return;

    const updatedHistory = target.history.map((record) =>
      record.month === selectedMonth
        ? { ...record, status: record.status === 'Paid' ? 'Pending' : 'Paid' }
        : record
    );

    const payload = {
      fields: {
        name: { stringValue: target.name },
        class: { stringValue: target.class },
        batch: { stringValue: target.batch },
        phone: { stringValue: target.phone },
        history: {
          arrayValue: {
            values: updatedHistory.map(h => ({
              mapValue: {
                fields: {
                  month: { stringValue: h.month },
                  amount: { stringValue: h.amount },
                  status: { stringValue: h.status }
                }
              }
            }))
          }
        }
      }
    };

    try {
      await fetch(`${BASE_URL}/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchStudents();
    } catch (err) {
      console.error(err);
    }
  };

  // REST DELETE WORKER ROUTINE
  const handleDeleteStudent = async (studentId) => {
    try {
      await fetch(`${BASE_URL}/${studentId}`, { method: 'DELETE' });
      fetchStudents();
    } catch (err) {
      console.error("Delete call anomaly: ", err);
    }
  };

  // NATIVE PROTOCOL COMMUNICATION DISPATCHERS
  const triggerWhatsAppReminder = (name, phoneNum, amt) => {
    const text = `Hello, this is a reminder from the Institute office regarding the pending coaching fee of ₹${amt} for the month of ${selectedMonth} for student ${name}. Please clear it at your earliest convenience.`;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}&phone=91${phoneNum}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`tel:${phoneNum}`);
      }
    });
  };

  // SCALING FILTER MATRIX WITH INTEGRATED SEARCH QUERY LOOKUP
  const filteredStudents = students.filter((student) => {
    const matchesBatch = batchFilter === 'All' || student.batch === batchFilter;
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.phone.includes(searchQuery);
    return matchesBatch && matchesSearch;
  });

  const activeStudentsThisMonth = students.filter((s) =>
    s.history && s.history.some((h) => h.month === selectedMonth)
  ).length;

  const totalFeesExpected = students.reduce((sum, student) => {
    const record = student.history && student.history.find((h) => h.month === selectedMonth);
    return sum + (record ? parseFloat(record.amount) || 0 : 0);
  }, 0);

  const totalFeesPending = students.reduce((sum, student) => {
    const record = student.history && student.history.find((h) => h.month === selectedMonth);
    return sum + (record && record.status === 'Pending' ? parseFloat(record.amount) || 0 : 0);
  }, 0);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      {currentScreen === 'login' ? (
        /* --- LOGIN SCREEN --- */
        <View style={styles.innerContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your dashboard</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#64748B"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#64748B"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.button} onPress={() => setCurrentScreen('home')}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* --- DASHBOARD SCREEN --- */
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContainer}
          ListHeaderComponent={
            <View>
              <View style={styles.headerRow}>
                <Text style={styles.titleLeft}>Dashboard</Text>
                <TouchableOpacity onPress={() => setCurrentScreen('login')}>
                  <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
              </View>

              {/* MONTH HORIZONTAL SEGMENTATION PANEL */}
              <View style={styles.monthScrollContainer}>
                <FlatList
                  horizontal
                  data={ACADEMIC_MONTHS}
                  keyExtractor={(item) => item}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.monthTab, selectedMonth === item && styles.monthTabActive]}
                      onPress={() => setSelectedMonth(item)}
                    >
                      <Text style={[styles.monthTabText, selectedMonth === item && styles.monthTabTextActive]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>

              {/* STATS AGGREGATES HUD MODULE */}
              <View style={styles.statsContainer}>
                <View style={styles.statsCard}>
                  <Text style={styles.statsLabel}>Total Roster</Text>
                  <Text style={styles.statsValue}>{students.length}</Text>
                </View>
                <View style={styles.statsCard}>
                  <Text style={styles.statsLabel}>{selectedMonth} Fees</Text>
                  <Text style={[styles.statsValue, { color: '#6366F1' }]}>₹{totalFeesExpected}</Text>
                </View>
                <View style={styles.statsCard}>
                  <Text style={styles.statsLabel}>Pending</Text>
                  <Text style={[styles.statsValue, { color: '#EF4444' }]}>₹{totalFeesPending}</Text>
                </View>
              </View>

              {/* STUDENT ENTRY FORM BLOCK */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Student Name"
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={setName}
                />
                
                <View style={styles.rowInputs}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Class / Course"
                    placeholderTextColor="#64748B"
                    value={studentClass}
                    onChangeText={setStudentClass}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Phone Number"
                    placeholderTextColor="#64748B"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>

                <View style={styles.toggleGroupContainer}>
                  <Text style={styles.inlineLabel}>Form Batch:</Text>
                  <View style={styles.toggleGroup}>
                    <TouchableOpacity 
                      style={[styles.toggleOption, batch === 'Morning' && styles.toggleOptionActive]}
                      onPress={() => setBatch('Morning')}
                    >
                      <Text style={[styles.toggleOptionText, batch === 'Morning' && styles.toggleOptionTextActive]}>Morning</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.toggleOption, batch === 'Evening' && styles.toggleOptionActive]}
                      onPress={() => setBatch('Evening')}
                    >
                      <Text style={[styles.toggleOptionText, batch === 'Evening' && styles.toggleOptionTextActive]}>Evening</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder={`Fee Amount for ${selectedMonth} (₹)`}
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />

                <TouchableOpacity style={styles.button} onPress={handleAddStudent}>
                  <Text style={styles.buttonText}>Submit Record</Text>
                </TouchableOpacity>
              </View>

              {/* ENHANCED LIVE FILTER & SEARCH BAR NODE */}
              <View style={styles.searchBlockContainer}>
                <TextInput 
                  style={styles.searchBarInput}
                  placeholder="🔍 Search name or phone among 300+ entries..."
                  placeholderTextColor="#64748B"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <View style={styles.directoryHeader}>
                <Text style={styles.sectionTitle}>Directory ({filteredStudents.length})</Text>
                <View style={styles.filterPillContainer}>
                  {['All', 'Morning', 'Evening'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.filterPill, batchFilter === type && styles.filterPillActive]}
                      onPress={() => setBatchFilter(type)}
                    >
                      <Text style={[styles.filterPillText, batchFilter === type && styles.filterPillTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const currentMonthRecord = item.history && item.history.find((h) => h.month === selectedMonth);

            return (
              <View style={styles.listItem}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.batchIndicatorBadge}>
                      <Text style={styles.batchIndicatorText}>{item.batch ? item.batch[0] : ''}</Text>
                    </View>
                  </View>
                  
                  {/* CLICK TO ACTION DEMOGRAPHIC INFO NODES */}
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                    <Text style={styles.studentSubtext}>{item.class} • 📞 <Text style={{textDecorationLine:'underline'}}>{item.phone}</Text></Text>
                  </TouchableOpacity>

                  {currentMonthRecord ? (
                    <Text style={styles.studentAmount}>₹{currentMonthRecord.amount}</Text>
                  ) : (
                    <Text style={[styles.studentAmount, { color: '#64748B' }]}>No invoice</Text>
                  )}
                </View>

                {/* DOUBLE ACTION FLOW BAR CONTAINER */}
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {currentMonthRecord ? (
                    <TouchableOpacity
                      style={[
                        styles.statusBadge,
                        currentMonthRecord.status === 'Paid' ? styles.badgePaid : styles.badgePending,
                      ]}
                      onPress={() => toggleStatus(item.id)}
                    >
                      <Text style={[styles.statusText, { color: currentMonthRecord.status === 'Paid' ? '#22C55E' : '#EF4444' }]}>
                        {currentMonthRecord.status}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.invoiceCreationButton}
                      onPress={() => createMissingInvoice(item.id, '2000')}
                    >
                      <Text style={styles.invoiceCreationText}>+ Invoice</Text>
                    </TouchableOpacity>
                  )}

                  {/* CONDITIONAL ACTION BADGES TRIGGER FOR PENDING COLLECTION FOLLOW-UPS */}
                  <View style={{flexDirection: 'row', gap: 4}}>
                    {currentMonthRecord && currentMonthRecord.status === 'Pending' && (
                      <TouchableOpacity 
                        style={styles.whatsappActionBadge}
                        onPress={() => triggerWhatsAppReminder(item.name, item.phone, currentMonthRecord.amount)}
                      >
                        <Text style={styles.whatsappActionText}>💬 Ping</Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                      style={styles.deleteActionBadge}
                      onPress={() => handleDeleteStudent(item.id)}
                    >
                      <Text style={styles.deleteActionText}>❌ Drop</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No matches found in database rosters.</Text>}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  innerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  scrollContainer: { paddingTop: 50, paddingHorizontal: 24, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '700', color: '#E5E7EB', textAlign: 'center' },
  titleLeft: { fontSize: 26, fontWeight: '700', color: '#E5E7EB' },
  directoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  subtitle: { fontSize: 15, color: '#94A3B8', marginBottom: 36, textAlign: 'center' },
  monthScrollContainer: { marginBottom: 20, height: 40 },
  monthTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#111827', marginRight: 8, borderWidth: 1, borderColor: '#1F2937', justifyContent: 'center' },
  monthTabActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  monthTabText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  monthTabTextActive: { color: '#FFFFFF' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 20 },
  statsCard: { flex: 1, backgroundColor: '#111827', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1F2937' },
  statsLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 },
  statsValue: { fontSize: 16, fontWeight: '700', color: '#E5E7EB' },
  inputContainer: { marginBottom: 16 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, fontSize: 15, color: '#E5E7EB', marginBottom: 10, borderWidth: 1, borderColor: '#1F2937' },
  searchBlockContainer: { marginBottom: 14 },
  searchBarInput: { backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, fontSize: 15, color: '#E5E7EB', borderWidth: 1, borderColor: '#374151' },
  toggleGroupContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111827', padding: 8, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#1F2937' },
  inlineLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '500', paddingLeft: 8 },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#0B1220', padding: 4, borderRadius: 8 },
  toggleOption: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  toggleOptionActive: { backgroundColor: '#1F2937' },
  toggleOptionText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  toggleOptionTextActive: { color: '#E5E7EB' },
  filterPillContainer: { flexDirection: 'row', backgroundColor: '#111827', padding: 4, borderRadius: 8, borderWidth: 1, borderColor: '#1F2937' },
  filterPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginLeft: 4 },
  filterPillActive: { backgroundColor: '#6366F1' },
  filterPillText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  filterPillTextActive: { color: '#FFFFFF' },
  button: { backgroundColor: '#6366F1', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  logoutText: { color: '#94A3B8', fontSize: 15, fontWeight: '500' },
  listItem: { backgroundColor: '#111827', padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#1F2937' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  studentName: { fontSize: 15, fontWeight: '600', color: '#E5E7EB', marginRight: 6, maxWidth: '80%' },
  batchIndicatorBadge: { backgroundColor: '#1F2937', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  batchIndicatorText: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  studentSubtext: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  studentAmount: { fontSize: 14, fontWeight: '600', color: '#6366F1' },
  statusBadge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  badgePaid: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)' },
  badgePending: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' },
  statusText: { fontSize: 11, fontWeight: '700' },
  whatsappActionBadge: { backgroundColor: 'rgba(34, 197, 94, 0.05)', borderColor: 'rgba(34, 197, 94, 0.2)', borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  whatsappActionText: { color: '#22C55E', fontSize: 11, fontWeight: '600' },
  deleteActionBadge: { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  deleteActionText: { color: '#EF4444', fontSize: 11, fontWeight: '600' },
  invoiceCreationButton: { backgroundColor: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.3)', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  invoiceCreationText: { color: '#6366F1', fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 30, fontSize: 14 }
});
