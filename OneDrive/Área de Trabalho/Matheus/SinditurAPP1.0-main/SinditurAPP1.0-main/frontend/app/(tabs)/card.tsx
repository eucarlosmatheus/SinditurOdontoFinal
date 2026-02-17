import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function CardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    const numbers = cpf.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').substring(0, 14);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Minha Carteirinha</Text>
          <Text style={styles.headerSubtitle}>Identificação do paciente</Text>
        </View>

        {/* Card */}
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Image
                source={require('../../assets/images/logo.jpg')}
                style={styles.cardLogo}
                resizeMode="contain"
              />
              <View style={styles.cardHeaderText}>
                <Text style={styles.clinicName}>Odonto Sinditur</Text>
                <Text style={styles.cardType}>Carteira do Paciente</Text>
              </View>
            </View>

            {/* Card Body */}
            <View style={styles.cardBody}>
              <View style={styles.userPhotoContainer}>
                <View style={styles.userPhotoPlaceholder}>
                  <Ionicons name="person" size={48} color="#1E88E5" />
                </View>
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.name}</Text>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>CPF</Text>
                  <Text style={styles.infoValue}>
                    {user?.cpf ? formatCPF(user.cpf) : ''}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Data de Nascimento</Text>
                  <Text style={styles.infoValue}>{user?.birth_date || ''}</Text>
                </View>
              </View>
            </View>

            {/* Card Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.cardId}>ID: {user?.id?.substring(0, 8).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* User Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Dados Cadastrais</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="person" size={20} color="#1E88E5" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Nome Completo</Text>
                <Text style={styles.detailValue}>{user?.name}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="card" size={20} color="#1E88E5" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>CPF</Text>
                <Text style={styles.detailValue}>{user?.cpf}</Text>
              </View>
            </View>

            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="calendar" size={20} color="#1E88E5" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Data de Nascimento</Text>
                <Text style={styles.detailValue}>{user?.birth_date}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#F44336" />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E88E5',
  },
  cardLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
  },
  cardHeaderText: {
    marginLeft: 12,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardType: {
    fontSize: 12,
    color: '#E3F2FD',
    marginTop: 2,
  },
  cardBody: {
    flexDirection: 'row',
    padding: 20,
  },
  userPhotoContainer: {
    marginRight: 16,
  },
  userPhotoPlaceholder: {
    width: 90,
    height: 110,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1E88E5',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoItem: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  cardFooter: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  cardId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  detailsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginLeft: 8,
  },
});
