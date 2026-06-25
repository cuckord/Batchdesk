import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  TextInput, 
  ActivityIndicator, 
  Modal,
  ScrollView,
  Linking
} from 'react-native';
import { auth } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const db = getFirestore();

const StudentCardItem = React.memo(({ item, selectedMonth, selectedYear, onToggleStatus, onDelete, onSendWhatsApp }) => {
  const currentKey = `${selectedMonth} ${selectedYear}`;
  const currentStatus = item.feesHistory && item.feesHistory[currentKey] ? item.feesHistory[currentKey] : 'PENDING';
  const isPaid = currentStatus === 'PAID';

  let totalOverdueAmount = 0;
  if (item.feesHistory) {
    Object.keys(item.feesHistory).forEach((key) => {
      if (item.feesHistory[key] === 'PENDING') {
        totalOverdueAmount += parseFloat(item.feeAmount) || 0;
      }
    });
  }
  if (totalOverdueAmount === 0 && currentStatus === 'PENDING') {
    totalOverdueAmount = parseFloat(item.feeAmount) || 0;
  }

  return (
    <View style={styles.studentCard}>
      <View style={styles.cardHeader}>
        <View style={styles.textContainer}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.studentCourse}>Course: {item.course}</Text>
        </View>
        <View style={styles.rightHeaderBlock}>
          <Text style={styles.cardFeeText}>₹{item.feeAmount || '0'}</Text>
          <TouchableOpacity 
            onPress={() => onToggleStatus(item, currentKey, currentStatus)}
            style={[styles.statusBadge, isPaid ? styles.badgePaid : styles.badgePending]}
          >
            <Text style={[styles.statusText, isPaid ? styles.textPaid : styles.textPending]}>
              {currentStatus}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.footerMeta}>{item.batch}</Text>
        <Text style={styles.footerMeta}>Total Due: ₹{totalOverdueAmount}</Text>
        
        <View style={styles.actionButtonsCluster}>
  {/* WhatsApp Remind Button (Pehle se hai) */}
  <TouchableOpacity
    onPress={() => onSendWhatsApp(item, totalOverdueAmount)}
    style={styles.whatsappActionBtn}
  >
    <Text style={styles.whatsappActionBtnText}>💬 Remind</Text>
  </TouchableOpacity>

  {/* 🛠️ NAYA EDIT BUTTON */}
  <TouchableOpacity
    onPress={() => onEdit(item)} 
    style={[styles.dropBtn, { backgroundColor: '#e0e0e0', marginRight: 8 }]} // Isko alag dikhane ke liye halka gray color
  >
    <Text style={[styles.dropBtnText, { color: '#333' }]}>Edit</Text>
  </TouchableOpacity>

  {/* Drop/Delete Button (Pehle se hai) */}
  <TouchableOpacity onPress={() => onDelete(item)} style={styles.dropBtn}>
    <Text style={styles.dropBtnText}>Drop</Text>
  </TouchableOpacity>
</View>

      </View>
    </View>
  );
});

StudentCardItem.displayName = 'StudentCardItem';

export default function App() {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const currentYearStr = new Date().getFullYear().toString();
  const monthsArray = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthStr = monthsArray[new Date().getMonth()];

  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  
  const [students, setStudents] = useState([]);
  const [isListLoading, setIsListLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL'); 
  const [activeDashboardTab, setActiveDashboardTab] = useState('LEDGER'); 

  const [statsPaid, setStatsPaid] = useState(0);
  const [statsPending, setStatsPending] = useState(0);
  const [morningCount, setMorningCount] = useState(0);
  const [eveningCount, setEveningCount] = useState(0);

  const [customAlertVisible, setCustomAlertVisible] = useState(false);
  const [customAlertTitle, setCustomAlertTitle] = useState('');
  const [customAlertMsg, setCustomAlertMsg] = useState('');
  const [customAlertConfirmHandler, setCustomAlertConfirmHandler] = useState(null);
  const [customAlertCancelVisible, setCustomAlertCancelVisible] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState(''); 
  const [formCourse, setFormCourse] = useState('');
  const [formFee, setFormFee] = useState(''); 
  const [formBatch, setFormBatch] = useState('☀️ Morning Batch');
  const [formCustomDate, setFormCustomDate] = useState('');
  const [isFormSaving, setIsFormSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const yearsArray = Array.from({ length: 15 }, (_, i) => (2024 + i).toString());

  useEffect(() => {
    const timer = setTimeout(() => { setShowSplash(false); }, 1500);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsBootstrapping(false);
    }, () => {
      setIsBootstrapping(false);
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || showSplash) return;
    setIsListLoading(true);
    const q = collection(db, 'students');
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setStudents(list);
      setIsListLoading(false);
    }, () => {
      setIsListLoading(false);
    });
  }, [user, showSplash]);

  useEffect(() => {
    let paidTotal = 0;
    let pendingTotal = 0;
    let morning = 0;
    let evening = 0;
    const currentKey = `${selectedMonth} ${selectedYear}`;

    students.forEach((student) => {
      if (student.isDeleted) return; 
      const fee = parseFloat(student.feeAmount) || 0;
      const status = student.feesHistory && student.feesHistory[currentKey] ? student.feesHistory[currentKey] : 'PENDING';
      
      if (status === 'PAID') { paidTotal += fee; } else { pendingTotal += fee; }
      
      if (student.batch && student.batch.includes('Morning')) { morning++; }
      if (student.batch && student.batch.includes('Evening')) { evening++; }
    });

    setStatsPaid(paidTotal);
    setStatsPending(pendingTotal);
    setMorningCount(morning);
    setEveningCount(evening);
  }, [students, selectedMonth, selectedYear]);

  const triggerCustomAlert = (title, message, onConfirm, showCancel = true) => {
    setCustomAlertTitle(title);
    setCustomAlertMsg(message);
    setCustomAlertConfirmHandler(() => () => {
      if (onConfirm) onConfirm();
      setCustomAlertVisible(false);
    });
    setCustomAlertCancelVisible(showCancel);
    setCustomAlertVisible(true);
  };

  const handleSendWhatsAppReminder = (student, totalDue) => {
    if (!student.phone || student.phone.trim().length !== 10) {
      triggerCustomAlert('Validation Alert', 'A valid 10-digit phone tracking metric is required for WhatsApp.', null, false);
      return;
    }
    const cleanPhone = `91${student.phone.trim()}`;
    const message = `Hello ${student.name},\nThis is a notification from Batchdesk. Your total accumulated pending tuition fee is *₹${totalDue}*. Kindly settle your balance nodes.\nThank you!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      triggerCustomAlert('System Error', 'Could not compile universal link matrix.', null, false);
    });
  };

  const handleAddStudentSubmit = async () => {
    const cleanPhone = formPhone.trim().replace(/[^0-9]/g, '');
    if (!formName.trim() || !formCourse.trim() || !formFee.trim() || cleanPhone.length !== 10) {
      triggerCustomAlert('Validation Error', 'Please populate valid details. Phone node must be exact 10 digits.', null, false);
      return;
    }

    const isDuplicate = students.some(s => !s.isDeleted && s.name.toLowerCase() === formName.trim().toLowerCase() && s.phone === cleanPhone);
    if (isDuplicate) {
      triggerCustomAlert('Security Hold', 'A student record with the identical name and phone architecture already exists.', null, false);
      return;
    }

    try {
      setIsFormSaving(true);
      const today = new Date();
      const currentDay = today.getDate().toString().padStart(2, '0');
      const defaultDateStr = `${currentDay} ${currentMonthStr} ${currentYearStr}`;
      const initialMonthKey = `${selectedMonth} ${selectedYear}`;
      
      await addDoc(collection(db, 'students'), {
        name: formName.trim(),
        phone: cleanPhone,
        course: formCourse.trim(),
        feeAmount: formFee.trim(),
        batch: formBatch,
        customJoinDate: formCustomDate.trim() || defaultDateStr,
        isDeleted: false, 
        feesHistory: {
          [initialMonthKey]: 'PAID'
        }
      });

      setFormName(''); setFormPhone(''); setFormCourse(''); setFormFee(''); setFormCustomDate('');
      setIsModalOpen(false);
      triggerCustomAlert('Success', 'Student node generated across global cluster views.', null, false);
    } catch (error) {
      triggerCustomAlert('Error', error.message, null, false);
    } finally {
      setIsFormSaving(false);
    }
  };

  const handleToggleFeesStatus = (student, monthKey, currentStatus) => {
    const targetNextStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    triggerCustomAlert(
      'Confirm Payment Action',
      `Are you sure you want to alter ${student.name}'s status to ${targetNextStatus} for ${monthKey}?`,
      async () => {
        try {
          const studentRef = doc(db, 'students', student.id);
          await updateDoc(studentRef, {
            [`feesHistory.${monthKey}`]: targetNextStatus
          });
        } catch (error) {
          triggerCustomAlert('Sync Failure', 'Could not sync execution matrix states.', null, false);
        }
      }
    );
  };

  const handleSoftDropStudent = (student) => {
    triggerCustomAlert(
      'Move to Trash',
      `Send ${student.name} to the Recycle Trash Bin node? Active records will hold safely inside background buffers.`,
      async () => {
        try {
          const studentRef = doc(db, 'students', student.id);
          await updateDoc(studentRef, { isDeleted: true });
        } catch (error) {
          triggerCustomAlert('Error', 'Drop processing pipeline failed.', null, false);
        }
      }
    );
  };

  const handleRestoreStudent = (studentId) => {
    try {
      const studentRef = doc(db, 'students', studentId);
      updateDoc(studentRef, { isDeleted: false });
      triggerCustomAlert('Restored', 'Student node brought back to active roster grids.', null, false);
    } catch (error) {
      triggerCustomAlert('Error', 'Could not finalize restoration pipelines.', null, false);
    }
  };

  const handlePermanentPurgeStudent = (studentId) => {
    triggerCustomAlert(
      '🚨 Permanent Delete',
      'This action is irreversible. Completely clear this student block from core database blocks?',
      async () => {
        try {
          await deleteDoc(doc(db, 'students', studentId));
        } catch (error) {
          triggerCustomAlert('Error', 'Purge pipeline failed.', null, false);
        }
      }
    );
  };

  const handleExportMonthlyLedgerCSV = async () => {
    const currentKey = `${selectedMonth} ${selectedYear}`;
    let csvContent = 'Student Name,Phone Node,Course,Batch,Admission Date,Fee Status,Amount\n';
    
    const targetDataset = students.filter(s => !s.isDeleted);
    if (targetDataset.length === 0) {
      triggerCustomAlert('Export Alert', 'No active dataset available inside current filter nodes to compile CSV.', null, false);
      return;
    }

    targetDataset.forEach(s => {
      const status = s.feesHistory && s.feesHistory[currentKey] ? s.feesHistory[currentKey] : 'PENDING';
      csvContent += `"${s.name}","${s.phone || 'N/A'}","${s.course}","${s.batch}","${s.customJoinDate}","${status}","${s.feeAmount}"\n`;
    });

    try {
      const fileUri = `${FileSystem.documentDirectory}Batchdesk_Ledger_${selectedMonth}_${selectedYear}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      triggerCustomAlert('Export Error', 'Could not trigger platform sharing drivers.', null, false);
    }
  };

  const getFilteredStudentsData = () => {
    let baseData = [...students];

    if (activeDashboardTab === 'TRASH') {
      return baseData.filter(s => s.isDeleted);
    }

    baseData = baseData.filter(s => !s.isDeleted);

    if (activeDashboardTab === 'DEFAULTERS') {
      baseData = baseData.filter(student => {
        let pendingMonthsCount = 0;
        if (student.feesHistory) {
          Object.keys(student.feesHistory).forEach(k => {
            if (student.feesHistory[k] === 'PENDING') pendingMonthsCount++;
          });
        }
        return pendingMonthsCount >= 2;
      });
    }

    if (selectedBatchFilter === 'MORNING') {
      baseData = baseData.filter(s => s.batch && s.batch.includes('Morning'));
    } else if (selectedBatchFilter === 'EVENING') {
      baseData = baseData.filter(s => s.batch && s.batch.includes('Evening'));
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      baseData = baseData.filter(s => 
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.course && s.course.toLowerCase().includes(query))
      );
    }

    return baseData;
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      triggerCustomAlert('Validation Alert', 'All authorization input fields are mandatory.', null, false);
      return;
    }
    try {
      setIsSubmitting(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      triggerCustomAlert('Failed Access', 'Invalid administrative network credentials.', null, false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const computedDisplayData = getFilteredStudentsData();

  if (showSplash || isBootstrapping) {
    return (
      <SafeAreaView style={[styles.container, styles.centeredSplash]}>
        <ActivityIndicator size="large" color="#0F172A" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>Portal Access</Text>
          <Text style={styles.authSubtitle}>Sign in to manage student metrics</Text>
          <TextInput style={styles.inputField} placeholder="Email Address" placeholderTextColor="#94A3B8" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.inputField} placeholder="Password" placeholderTextColor="#94A3B8" secureTextEntry value={password} onChangeText={setPassword} autoCapitalize="none" />
          <TouchableOpacity style={styles.primaryAuthBtn} onPress={handleLogin} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.primaryAuthBtnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.contentWrapper}>
        
        <View style={styles.headerRow}>
          <Text style={styles.dashboardTitle}>Batchdesk Pro</Text>
          <TouchableOpacity onPress={() => signOut(auth)}><Text style={styles.logoutText}>Logout</Text></TouchableOpacity>
        </View>

        <View style={styles.summaryWidgetRow}>
          <View style={[styles.summaryCard, styles.summaryCardPaid]}>
            <Text style={styles.summaryLabel}>Total Paid ({selectedMonth})</Text>
            <Text style={[styles.summaryValue, styles.textPaid]}>₹{statsPaid}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardPending]}>
            <Text style={styles.summaryLabel}>Total Pending ({selectedMonth})</Text>
            <Text style={[styles.summaryValue, styles.textPending]}>₹{statsPending}</Text>
          </View>
        </View>

        <View style={styles.occupancyMetricBar}>
          <Text style={styles.occupancyLabelText}>👥 Active: {students.filter(s=>!s.isDeleted).length}</Text>
          <Text style={styles.occupancyLabelText}>☀️ Morning: {morningCount}</Text>
          <Text style={styles.occupancyLabelText}>🌙 Evening: {eveningCount}</Text>
        </View>

        <View style={styles.luxuryTabToggleContainer}>
          <TouchableOpacity style={[styles.luxuryTabBtn, activeDashboardTab === 'LEDGER' && styles.luxuryTabBtnActive]} onPress={() => setActiveDashboardTab('LEDGER')}>
            <Text style={[styles.luxuryTabBtnText, activeDashboardTab === 'LEDGER' && styles.luxuryTabBtnTextActive]}>📊 Ledger</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.luxuryTabBtn, activeDashboardTab === 'DEFAULTERS' && styles.luxuryTabBtnActive, activeDashboardTab === 'DEFAULTERS' && {backgroundColor: '#FEF2F2'}]} onPress={() => setActiveDashboardTab('DEFAULTERS')}>
            <Text style={[styles.luxuryTabBtnText, activeDashboardTab === 'DEFAULTERS' && {color: '#EF4444', fontWeight: '800'}]}>⚠️ Overdue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.luxuryTabBtn, activeDashboardTab === 'TRASH' && styles.luxuryTabBtnActive, activeDashboardTab === 'TRASH' && {backgroundColor: '#F1F5F9'}]} onPress={() => setActiveDashboardTab('TRASH')}>
            <Text style={[styles.luxuryTabBtnText, activeDashboardTab === 'TRASH' && {color: '#475569', fontWeight: '800'}]}>🗑️ Trash</Text>
          </TouchableOpacity>
        </View>

        {activeDashboardTab !== 'TRASH' && (
          <>
            <View style={styles.searchBarWrapperContainer}>
              <TextInput style={styles.searchBarInputField} placeholder="Search student name or course track..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <View style={styles.filterPillsWrapperRow}>
              {['ALL', 'MORNING', 'EVENING'].map((filter) => (
                <TouchableOpacity key={filter} style={[styles.filterPillCell, selectedBatchFilter === filter && styles.filterPillCellActive]} onPress={() => setSelectedBatchFilter(filter)}>
                  <Text style={[styles.filterPillCellText, selectedBatchFilter === filter && styles.filterPillCellTextActive]}>
                    {filter === 'ALL' ? '⚡ All Filters' : filter === 'MORNING' ? '☀️ Morning' : '🌙 Evening'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {isListLoading ? (
          <View style={styles.centered}><ActivityIndicator size="small" color="#0F172A" /></View>
        ) : (
          <FlatList
            data={computedDisplayData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (activeDashboardTab === 'TRASH') {
                return (
                  <View style={styles.studentCard}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}><Text style={styles.studentName}>{item.name} [TRASHED]</Text><Text style={styles.studentCourse}>{item.course} - {item.batch}</Text></View>
                    </View>
                    <View style={[styles.cardFooter, { borderTopWidth: 0, marginTop: 4 }]}>
                      <TouchableOpacity style={styles.restoreBtn} onPress={() => handleRestoreStudent(item.id)}><Text style={styles.restoreBtnText}>🔄 Restore Student</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.purgeBtn} onPress={() => handlePermanentPurgeStudent(item.id)}><Text style={styles.purgeBtnText}>Purge Forever</Text></TouchableOpacity>
                    </View>
                  </View>
                );
              }
              return (
                <StudentCardItem 
                  item={item} 
                  selectedMonth={selectedMonth} 
                  selectedYear={selectedYear} 
                  onToggleStatus={handleToggleFeesStatus}
                  onDelete={handleSoftDropStudent} 
                  onSendWhatsApp={handleSendWhatsAppReminder}
                />
              );
            }}
            ListEmptyComponent={
              <View style style={styles.emptyStateCard}>
                <Text style={styles.emptyStateText}>
                  {activeDashboardTab === 'TRASH' ? 'Trash node buffer is entirely clean.' : 'No data packets matched this active scope configuration.'}
                </Text>
              </View>
            }
            ListHeaderComponent={
              <View style={styles.listHeaderRow}>
                {activeDashboardTab === 'LEDGER' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity style={styles.premiumDropdownCapsule} onPress={() => setIsDatePickerOpen(true)}>
                      <Text style={styles.premiumDropdownCapsuleText}>📅 {selectedMonth} {selectedYear}  ▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.exportExcelLinkBtn} onPress={handleExportMonthlyLedgerCSV}>
                      <Text style={styles.exportExcelLinkText}>📥 Export CSV</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.defaulterListTitleLabel}>
                    {activeDashboardTab === 'TRASH' ? '🗑️ Discarded Node Trash Bin' : '🚨 Multi-Month Overdue Balance'}
                  </Text>
                )}

                {activeDashboardTab !== 'TRASH' && (
                  <TouchableOpacity style={styles.addStudentLinkBtn} onPress={() => setIsModalOpen(true)}>
                    <Text style={styles.addStudentLinkText}>+ Add Student</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            contentContainerStyle={styles.verticalListContent}
          />
        )}
      </View>

      <Modal animationType="fade" transparent={true} visible={customAlertVisible} onRequestClose={() => setCustomAlertVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { maxWidth: 320, alignItems: 'center' }]}>
            <Text style={[styles.modalTitle, { fontSize: 16 }]}>{customAlertTitle}</Text>
            <Text style={[styles.modalSubtitle, { marginTop: 8, marginBottom: 20, fontSize: 13, color: '#334155', textAlign: 'center' }]}>{customAlertMsg}</Text>
            <View style={{ flexDirection: 'row', width: '100%' }}>
              {customAlertCancelVisible && (
                <TouchableOpacity style={[styles.cancelActionBtn, { paddingVertical: 8, marginTop: 0 }]} onPress={() => setCustomAlertVisible(false)}>
                  <Text style={styles.cancelActionText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.primaryAuthBtn, { flex: 1, marginTop: 0, paddingVertical: 8, marginLeft: customAlertCancelVisible ? 8 : 0 }]} onPress={customAlertConfirmHandler}>
                <Text style={styles.primaryAuthBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={isDatePickerOpen} onRequestClose={() => setIsDatePickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { maxWidth: 340, maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Select Target Period</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.innerLabel}>Months:</Text>
              <View style={styles.gridContainer}>
                {monthsArray.map((m) => (
                  <TouchableOpacity key={m} style={[styles.gridItemCell, selectedMonth === m && styles.gridItemCellActive]} onPress={() => setSelectedMonth(m)}>
                    <Text style={[styles.gridItemText, selectedMonth === m && styles.gridItemTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.innerLabel, { marginTop: 16 }]}>Years:</Text>
              <View style={styles.gridContainer}>
                {yearsArray.map((y) => (
                  <TouchableOpacity key={y} style={[styles.gridItemCell, selectedYear === y && styles.gridItemCellActive]} onPress={() => setSelectedYear(y)}>
                    <Text style={[styles.gridItemText, selectedYear === y && styles.gridItemTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.primaryAuthBtn, { marginTop: 16 }]} onPress={() => setIsDatePickerOpen(false)}><Text style={styles.primaryAuthBtnText}>Apply Layout</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={isModalOpen} onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>New Student Registration</Text>
              <Text style={styles.modalSubtitle}>Scope allocation: Global Ledger Cluster</Text>
              
              <TextInput style={styles.modalInput} placeholder="Student Full Name" placeholderTextColor="#94A3B8" value={formName} onChangeText={setFormName} />
              <TextInput style={styles.modalInput} placeholder="WhatsApp Phone (10 digits only)" placeholderTextColor="#94A3B8" keyboardType="phone-pad" maxLength={10} value={formPhone} onChangeText={setFormPhone} />
              <TextInput style={styles.modalInput} placeholder="Enrolled Course Track" placeholderTextColor="#94A3B8" value={formCourse} onChangeText={setFormCourse} />
              <TextInput style={styles.modalInput} placeholder="Fee Amount Per Month (INR)" placeholderTextColor="#94A3B8" keyboardType="numeric" value={formFee} onChangeText={setFormFee} />
              <TextInput style={styles.modalInput} placeholder="Custom Join Date (Optional)" placeholderTextColor="#94A3B8" value={formCustomDate} onChangeText={setFormCustomDate} />
              
              <Text style={styles.innerLabel}>Select Batch Node Allocation:</Text>
              <View style={styles.toggleRow}>
                {['☀️ Morning Batch', '🌙 Evening Batch'].map(b => (
                  <TouchableOpacity key={b} style={[styles.toggleOptionBtn, formBatch === b && styles.toggleOptionBtnActive]} onPress={() => setFormBatch(b)}>
                    <Text style={[styles.toggleOptionText, formBatch === b && styles.toggleOptionTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.cancelActionBtn} onPress={() => setIsModalOpen(false)}><Text style={styles.cancelActionText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveActionBtn} onPress={handleAddStudentSubmit} disabled={isFormSaving}>
                  {isFormSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveActionText}>Register</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { justifyContent: 'center', alignItems: 'center', paddingVertical: 32 },
  centeredSplash: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  authContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  authCard: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  authTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  authSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  inputField: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, color: '#0F172A', marginBottom: 12 },
  primaryAuthBtn: { backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryAuthBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  contentWrapper: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  dashboardTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
  
  summaryWidgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  summaryCardPaid: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7', marginRight: 4 },
  summaryCardPending: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2', marginLeft: 4 },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', marginBottom: 2 },
  summaryValue: { fontSize: 18, fontWeight: '800' },

  occupancyMetricBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  occupancyLabelText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  luxuryTabToggleContainer: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 12, marginBottom: 10 },
  luxuryTabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  luxuryTabBtnActive: { backgroundColor: '#FFFFFF', elevation: 1 },
  luxuryTabBtnText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  luxuryTabBtnTextActive: { color: '#0F172A' },

  searchBarWrapperContainer: { marginBottom: 8 },
  searchBarInputField: { backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A', fontSize: 13 },

  filterPillsWrapperRow: { flexDirection: 'row', marginBottom: 12 },
  filterPillCell: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 6 },
  filterPillCellActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterPillCellText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  filterPillCellTextActive: { color: '#FFFFFF' },

  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  premiumDropdownCapsule: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  premiumDropdownCapsuleText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  exportExcelLinkBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#475569', marginLeft: 8 },
  exportExcelLinkText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  defaulterListTitleLabel: { fontSize: 13, fontWeight: '800', color: '#EF4444' },

  addStudentLinkBtn: { backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addStudentLinkText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  verticalListContent: { paddingBottom: 32 },
  
  emptyStateCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 14, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', marginTop: 12 },
  emptyStateText: { color: '#64748B', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  gridItemCell: { width: '22%', paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 8, alignItems: 'center', margin: '1.5%' },
  gridItemCellActive: { backgroundColor: '#0F172A' },
  gridItemText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  gridItemTextActive: { color: '#FFFFFF' },

  studentCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textContainer: { flex: 1, paddingRight: 8 },
  studentName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  studentCourse: { color: '#475569', fontSize: 12, marginTop: 1 },
  rightHeaderBlock: { alignItems: 'flex-end' },
  cardFeeText: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgePaid: { backgroundColor: '#DCFCE7' },
  badgePending: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 10, fontWeight: '700' },
  textPaid: { color: '#15803D' },
  textPending: { color: '#B91C1C' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  footerMeta: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  
  actionButtonsCluster: { flexDirection: 'row', alignItems: 'center' },
  whatsappActionBtn: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6, borderWidth: 0.5, borderColor: '#BBF7D0' },
  whatsappActionBtnText: { color: '#16A34A', fontSize: 11, fontWeight: '700' },
  dropBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FEF2F2' },
  dropBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 11 },

  restoreBtn: { backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  restoreBtnText: { color: '#0369A1', fontSize: 11, fontWeight: '700' },
  purgeBtn: { backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  purgeBtnText: { color: '#EF4444', fontSize: 11, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContentCard: { width: '100%', maxWidth: 340, backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 5 },
  modalSubtitle: { fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 2, marginBottom: 16 },
  modalInput: { backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, color: '#0F172A', marginBottom: 10, fontSize: 13 },
  innerLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 4, marginBottom: 4 },
  toggleRow: { flexDirection: 'row', marginBottom: 12 },
  toggleOptionBtn: { flex: 1, paddingVertical: 8, backgroundColor: '#F1F5F9', alignItems: 'center', borderRadius: 8, marginRight: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  toggleOptionBtnActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  toggleOptionText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  toggleOptionTextActive: { color: '#FFFFFF', fontWeight: '700' },
  modalActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  cancelActionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#F1F5F9', marginTop: 0 },
  cancelActionText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  saveActionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#0F172A', marginLeft: 12 },
  saveActionText: { color: '#FFF', fontWeight: '700', fontSize: 13 }
});
