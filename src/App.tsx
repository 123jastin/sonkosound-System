// In App.tsx, update syncDatabaseStates:

const syncDatabaseStates = useCallback(async () => {
  setIsLoading(true);
  setError(null);

  try {
    const [
      customersData,
      debtsData,
      paymentsData,
      suppliersData,
      settingsData
    ] = await Promise.all([
      api.customers.list(),
      api.debts.list(),
      api.payments.list(),
      api.suppliers.list(),
      api.settings.get()
    ]);

    // Transform API data to match frontend types
    const transformedCustomers: Customer[] = (customersData || []).map((c: any) => ({
      id: c.id,
      fullName: c.full_name,
      phoneNumber: c.phone_number,
      address: c.address || '',
      businessName: c.business_name || '',
      notes: c.notes || '',
      photoUrl: c.photo_url || '',
      createdAt: c.created_at || new Date().toISOString().split('T')[0]
    }));

    const transformedDebts: Debt[] = (debtsData || []).map((d: any) => ({
      id: d.id,
      customerId: d.customer_id,
      amount: d.amount,
      dateBorrowed: d.date_borrowed,
      dueDate: d.due_date,
      description: d.description,
      category: d.category || 'Mizigo/Products',
      notes: d.notes || '',
      status: d.status || 'Active',
      createdAt: d.created_at || new Date().toISOString()
    }));

    const transformedPayments: Payment[] = (paymentsData || []).map((p: any) => ({
      id: p.id,
      debtId: p.debt_id,
      amount: p.amount,
      date: p.date,
      paymentMethod: p.payment_method,
      notes: p.notes || '',
      createdAt: p.created_at || new Date().toISOString()
    }));

    const transformedSuppliers: Supplier[] = (suppliersData || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      phoneNumber: s.phone_number,
      amount: s.amount,
      paidAmount: s.paid_amount,
      dueDate: s.due_date,
      notes: s.notes || '',
      createdAt: s.created_at || new Date().toISOString().split('T')[0],
      products: (s.products || []).map((p: any) => ({
        id: p.id,
        description: p.description,
        amount: p.amount,
        dueDate: p.due_date,
        notes: p.notes || '',
        createdAt: p.created_at || new Date().toISOString().split('T')[0]
      })),
      payments: (s.payments || []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        date: p.date,
        notes: p.notes || '',
        createdAt: p.created_at || new Date().toISOString()
      }))
    }));

    const transformedSettings: BusinessSettings = settingsData ? {
      businessName: settingsData.business_name || 'My Business',
      businessAddress: settingsData.business_address || '',
      businessPhone: settingsData.business_phone || ''
    } : {
      businessName: 'My Business',
      businessAddress: '',
      businessPhone: ''
    };

    setCustomers(transformedCustomers);
    setDebts(transformedDebts);
    setPayments(transformedPayments);
    setSuppliers(transformedSuppliers);
    setSettings(transformedSettings);

    // Generate notifications from synced data
    const generatedNotifications = generateNotificationsFromData(
      transformedCustomers,
      transformedDebts,
      transformedPayments
    );
    setNotifications(generatedNotifications);

  } catch (err: any) {
    console.error('Failed to sync data:', err);
    
    // Only show error if it's NOT a 404 on empty data
    if (err.message.includes('JSON') || err.message.includes('<!DOCTYPE')) {
      // API not set up yet - load from cache silently
      tryLoadFromLocalStorage();
      console.log('API endpoints not available yet, using cached data');
    } else {
      setError(err.message || 'Imeshindwa kupakia data. Jaribu tena.');
      tryLoadFromLocalStorage();
    }
  } finally {
    setIsLoading(false);
  }
}, []);
