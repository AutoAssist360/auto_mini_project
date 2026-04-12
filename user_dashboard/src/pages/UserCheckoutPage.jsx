import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { QRCodeSVG } from 'qrcode.react'
import { removeOrderedItems, selectCartGroupedByWarehouse, selectCartTotal } from '../store/cartSlice'
import { createOrder, getOrderQrData, payOrder } from '../lib/api'
import MobileNav from '../components/MobileNav'
import Breadcrumbs from '../components/Breadcrumbs'
import LocationPicker from '../components/LocationPicker'
import { useToast } from '../components/toastContext'

function UserCheckoutPage ( { theme, onToggleTheme } )
{
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { toast } = useToast()

  const groupedCart = useSelector( selectCartGroupedByWarehouse )
  const cartTotal = useSelector( selectCartTotal )

  const [ notes, setNotes ] = useState( '' )
  const [ delivery, setDelivery ] = useState( {
    delivery_contact_name: '',
    delivery_phone: '',
    delivery_address: '',
    delivery_city: '',
    delivery_state: '',
    delivery_postal_code: '',
    delivery_latitude: '',
    delivery_longitude: '',
    delivery_instructions: '',
  } )
  const [ isPreparingPayment, setIsPreparingPayment ] = useState( false )
  const [ paymentOrders, setPaymentOrders ] = useState( [] )
  const [ paymentSuccess, setPaymentSuccess ] = useState( false )
  const [ paymentMethod, setPaymentMethod ] = useState( 'upi' )
  const [ checkoutSnapshot, setCheckoutSnapshot ] = useState( null )
  const [ successMessage, setSuccessMessage ] = useState( 'Your part orders were placed and all payments were confirmed.' )
  const [ successOrderCount, setSuccessOrderCount ] = useState( 0 )

  const cartGroups = Object.values( groupedCart )
  const activeCartGroups = checkoutSnapshot?.groups || cartGroups
  const activeCartTotal = checkoutSnapshot?.total ?? cartTotal
  const TAX_RATE = 0.18
  const taxAmount = activeCartTotal * TAX_RATE
  const grandTotal = activeCartTotal + taxAmount
  const isPaymentStep = paymentOrders.length > 0
  const completedPayments = paymentOrders.filter( ( order ) => order.payment_status === 'completed' ).length
  const successRedirectPath = paymentMethod === 'cash_on_delivery' ? '/orders' : '/dashboard'
  const isDeliveryReady = delivery.delivery_contact_name.trim()
    && /^\d{10}$/.test( delivery.delivery_phone.trim() )
    && (
      delivery.delivery_address.trim()
      || (
        delivery.delivery_latitude !== ''
        && delivery.delivery_longitude !== ''
      )
    )

  if ( cartGroups.length === 0 && !isPaymentStep && !paymentSuccess )
  {
    navigate( '/parts' )
    return null
  }

  const isUuid = ( value ) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test( value )

  const formatPrice = ( price ) =>
  {
    return `₹${ Number( price ).toLocaleString( 'en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 } ) }`
  }

  const updatePaymentOrder = ( orderId, updates ) =>
  {
    setPaymentOrders( ( prev ) =>
      prev.map( ( order ) => (
        order.order_id === orderId
          ? { ...order, ...( typeof updates === 'function' ? updates( order ) : updates ) }
          : order
      ) )
    )
  }

  const createCheckoutSnapshot = () =>
  {
    return {
      total: cartTotal,
      groups: cartGroups.map( ( group ) => ( {
        ...group,
        items: group.items.map( ( item ) => ( { ...item } ) ),
      } ) ),
    }
  }

  const getOrderedCartItems = ( snapshot ) =>
  {
    return snapshot.groups.flatMap( ( group ) =>
      group.items.map( ( item ) => ( {
        part_id: item.part_id,
        warehouse_id: item.warehouse_id,
        inventory_id: item.inventory_id,
      } ) )
    )
  }

  const handleCopy = async ( value, label ) =>
  {
    if ( !value ) return
    try
    {
      await navigator.clipboard.writeText( value )
      toast.success( `${ label } copied` )
    } catch
    {
      toast.error( `Unable to copy ${ label.toLowerCase() }` )
    }
  }

  const handleDeliveryFieldChange = ( field ) => ( event ) =>
  {
    setDelivery( ( prev ) => ( { ...prev, [ field ]: event.target.value } ) )
  }

  const handleProceedToPay = async () =>
  {
    if ( !isDeliveryReady )
    {
      toast.error( 'Please add delivery contact details and a delivery address or map pin.' )
      return
    }

    setIsPreparingPayment( true )

    try
    {
      const preparedCheckoutSnapshot = createCheckoutSnapshot()
      const createdPaymentOrders = []
      const createdOrders = []

      for ( const group of cartGroups )
      {
        const orderResponse = await createOrder( {
          warehouse_id: isUuid( group.warehouse_id ) ? String( group.warehouse_id ) : undefined,
          payment_method: paymentMethod,
          notes: notes.trim() || undefined,
          delivery_contact_name: delivery.delivery_contact_name.trim(),
          delivery_phone: delivery.delivery_phone.trim(),
          delivery_address: delivery.delivery_address.trim() || undefined,
          delivery_city: delivery.delivery_city.trim() || undefined,
          delivery_state: delivery.delivery_state.trim() || undefined,
          delivery_postal_code: delivery.delivery_postal_code.trim() || undefined,
          delivery_latitude: delivery.delivery_latitude !== '' ? Number( delivery.delivery_latitude ) : undefined,
          delivery_longitude: delivery.delivery_longitude !== '' ? Number( delivery.delivery_longitude ) : undefined,
          delivery_instructions: delivery.delivery_instructions.trim() || undefined,
          items: group.items.map( ( item ) => ( {
            part_id: Number( item.part_id ),
            quantity: Number( item.quantity ),
            inventory_id: item.inventory_id,
          } ) ),
        } )

        const createdOrder = orderResponse?.order
        createdOrders.push( createdOrder )

        if ( paymentMethod === 'cash_on_delivery' ) {
          continue
        }

        const qrResponse = await getOrderQrData( createdOrder.order_id )

        createdPaymentOrders.push( {
          order_id: createdOrder.order_id,
          order_number: createdOrder.order_number,
          warehouse_name: qrResponse.warehouse_name || group.warehouse_name,
          vendor_name: qrResponse.vendor_name || 'Vendor',
          vendor_upi_id: qrResponse.vendor_upi_id || '',
          amount: Number( qrResponse.amount ),
          reference: qrResponse.reference,
          upi_url: qrResponse.upi_url,
          transaction_id: '',
          payment_status: 'pending',
          is_confirming: false,
        } )
      }

      setCheckoutSnapshot( preparedCheckoutSnapshot )
      dispatch( removeOrderedItems( getOrderedCartItems( preparedCheckoutSnapshot ) ) )

      if ( paymentMethod === 'cash_on_delivery' ) {
        setSuccessOrderCount( createdOrders.length )
        setSuccessMessage( 'Your part orders were placed successfully. You can pay when they are delivered.' )
        setPaymentSuccess( true )
        toast.success( `Orders placed with cash on delivery${ createdOrders.length > 1 ? ' for all vendors' : '' }.` )
        setTimeout( () => navigate( successRedirectPath ), 3000 )
        return
      }

      setPaymentOrders( createdPaymentOrders )
        toast.success( 'Orders created. Scan each QR code and confirm each payment.' )
    } catch ( error )
    {
      const detail = error?.data?.errors?.[ 0 ]?.message
      toast.error( detail || error.message || 'Unable to prepare vendor payment QR codes.' )
    } finally
    {
      setIsPreparingPayment( false )
    }
  }

  const handleConfirmPayment = async ( paymentOrder ) =>
  {
    const transactionId = paymentOrder.transaction_id.trim()
    if ( !transactionId )
    {
      toast.error( `Enter the UPI transaction ID for ${ paymentOrder.vendor_name }` )
      return
    }

    updatePaymentOrder( paymentOrder.order_id, { is_confirming: true } )

    try
    {
      await payOrder( paymentOrder.order_id, {
        payment_method: 'upi',
        transaction_id: transactionId,
      } )

      let nextOrders = []
      setPaymentOrders( ( prev ) =>
      {
        nextOrders = prev.map( ( order ) => (
          order.order_id === paymentOrder.order_id
            ? { ...order, payment_status: 'completed', is_confirming: false }
            : order
        ) )
        return nextOrders
      } )

      toast.success( `Payment confirmed for ${ paymentOrder.vendor_name }` )

      if ( nextOrders.length > 0 && nextOrders.every( ( order ) => order.payment_status === 'completed' ) )
      {
        setSuccessOrderCount( nextOrders.length )
        setPaymentSuccess( true )
        toast.success( 'All vendor payments confirmed successfully.' )
        setTimeout( () => navigate( successRedirectPath ), 3000 )
      }
    } catch ( error )
    {
      updatePaymentOrder( paymentOrder.order_id, { is_confirming: false } )
      toast.error( error.message || 'Unable to confirm this payment.' )
    }
  }

  if ( paymentSuccess )
  {
    return (
      <div className="min-h-screen bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <svg className="h-12 w-12 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {paymentMethod === 'cash_on_delivery' ? 'Order placed' : 'Payment confirmed'}
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                {successMessage}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {paymentMethod === 'cash_on_delivery' ? 'Orders placed' : 'Payments completed'}
              </p>
              <p className="mt-1 text-3xl font-black text-blue-600 dark:text-blue-400">{successOrderCount}</p>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Redirecting to {paymentMethod === 'cash_on_delivery' ? 'your orders' : 'your dashboard'}...
            </p>
            <button
              type="button"
              onClick={() => navigate( successRedirectPath )}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {paymentMethod === 'cash_on_delivery' ? 'View my orders' : 'Go to dashboard'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Checkout</h1>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {isPaymentStep
                  ? 'Pay each seller using the UPI QR codes shown here.'
                  : paymentMethod === 'cash_on_delivery'
                    ? 'Review your items and place the order with cash on delivery.'
                    : 'Review your items and create payment QR codes for each seller.'}
              </p>
            </div>
            <MobileNav>
              <button type="button" onClick={onToggleTheme} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </MobileNav>
          </div>
        </header>

        <Breadcrumbs items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Parts', to: '/parts' },
          { label: 'Checkout' },
        ]} />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {!isPaymentStep && activeCartGroups.map( ( group, index ) =>
            {
              return (
                <section key={`${ group.warehouse_id || group.warehouse_name || 'group' }-${ index }`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div>
                      <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                        <span className="text-xl">🏪</span>
                        {group.warehouse_name}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">Sold by this seller</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {group.items.map( ( item ) => (
                      <div key={item.part_id} className="flex flex-wrap justify-between gap-4 rounded-2xl border border-transparent bg-slate-50 p-3 dark:bg-slate-800/50">
                        <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.part_name}</p>
                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">{item.category_name}</p>
                          <p className="mt-2 text-sm text-slate-500">
                            Qty: <span className="font-semibold text-slate-800 dark:text-slate-200">{item.quantity}</span>
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white">{formatPrice( item.unit_cost * item.quantity )}</p>
                          <p className="mt-0.5 whitespace-nowrap text-xs text-slate-400">{formatPrice( item.unit_cost )} each</p>
                        </div>
                      </div>
                    ) )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-2 pt-3 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-500">Seller subtotal</span>
                    <span className="whitespace-nowrap text-sm font-bold text-slate-900 dark:text-white">{formatPrice( group.subtotal )}</span>
                  </div>
                </section>
              )
            } )}

            {isPaymentStep && paymentOrders.map( ( paymentOrder ) => (
              <section key={paymentOrder.order_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Pay seller</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{paymentOrder.vendor_name}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{paymentOrder.warehouse_name}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ paymentOrder.payment_status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }`}>
                    {paymentOrder.payment_status === 'completed' ? 'Paid' : 'Waiting for payment'}
                  </span>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[240px,1fr]">
                  <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
                    <div className="flex justify-center rounded-2xl border-2 border-blue-300 bg-white p-3 dark:border-blue-700">
                      <QRCodeSVG value={paymentOrder.upi_url} size={180} level="H" includeMargin />
                    </div>
                    <a
                      href={paymentOrder.upi_url}
                      className="mt-4 block whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-500"
                    >
                      Open in UPI App
                    </a>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Amount</p>
                        <p className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">{formatPrice( paymentOrder.amount )}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reference</p>
                        <p className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-white">{paymentOrder.reference}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Vendor UPI ID</p>
                          <p className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-white">{paymentOrder.vendor_upi_id}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy( paymentOrder.vendor_upi_id, 'UPI ID' )}
                          className="whitespace-nowrap rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          Copy UPI ID
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <label htmlFor={`txn-${ paymentOrder.order_id }`} className="mb-2 block text-sm font-medium">
                        UPI Transaction ID
                      </label>
                      <input
                        id={`txn-${ paymentOrder.order_id }`}
                        value={paymentOrder.transaction_id}
                        onChange={( event ) => updatePaymentOrder( paymentOrder.order_id, { transaction_id: event.target.value } )}
                        placeholder="Enter the UPI transaction ID after payment"
                        disabled={paymentOrder.payment_status === 'completed'}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleConfirmPayment( paymentOrder )}
                        disabled={paymentOrder.payment_status === 'completed' || paymentOrder.is_confirming}
                        className="mt-3 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {paymentOrder.payment_status === 'completed'
                          ? 'Payment confirmed'
                          : paymentOrder.is_confirming
                            ? 'Confirming...'
                            : 'Confirm Payment'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) )}
          </div>

          <div className="space-y-6">
            <section className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
                {isPaymentStep ? 'Payment progress' : 'Order summary'}
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2 text-slate-600 dark:text-slate-400">
                  <span>Items Subtotal</span>
                  <span className="whitespace-nowrap font-medium text-slate-900 dark:text-white">{formatPrice( activeCartTotal )}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-slate-600 dark:text-slate-400">
                  <span>Estimated tax (18% GST)</span>
                  <span className="whitespace-nowrap font-medium text-slate-900 dark:text-white">{formatPrice( taxAmount )}</span>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-bold text-slate-900 dark:text-white">Grand Total</span>
                    <span className="whitespace-nowrap text-2xl font-black text-blue-600 dark:text-blue-400">{formatPrice( grandTotal )}</span>
                  </div>
                </div>
              </div>

              {!isPaymentStep && (
                <div className="mt-6">
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Payment Method
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('upi')}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          paymentMethod === 'upi'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                        }`}
                      >
                        <p className="text-sm font-semibold">UPI Payment</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Create seller QR codes and pay now.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash_on_delivery')}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          paymentMethod === 'cash_on_delivery'
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                        }`}
                      >
                        <p className="text-sm font-semibold">Cash on Delivery</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Pay when the order reaches you.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Delivery Details
                    </p>
                    <div className="mt-3 grid gap-3">
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Contact Name
                        </label>
                        <input
                          value={delivery.delivery_contact_name}
                          onChange={handleDeliveryFieldChange( 'delivery_contact_name' )}
                          placeholder="Who should receive the order?"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Phone Number
                        </label>
                        <input
                          value={delivery.delivery_phone}
                          onChange={handleDeliveryFieldChange( 'delivery_phone' )}
                          placeholder="10 digit mobile number"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Delivery Address
                        </label>
                        <textarea
                          value={delivery.delivery_address}
                          onChange={handleDeliveryFieldChange( 'delivery_address' )}
                          placeholder="House number, street, landmark"
                          rows={3}
                          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          value={delivery.delivery_city}
                          onChange={handleDeliveryFieldChange( 'delivery_city' )}
                          placeholder="City"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <input
                          value={delivery.delivery_state}
                          onChange={handleDeliveryFieldChange( 'delivery_state' )}
                          placeholder="State"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <input
                          value={delivery.delivery_postal_code}
                          onChange={handleDeliveryFieldChange( 'delivery_postal_code' )}
                          placeholder="Postal code"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <LocationPicker
                        latitude={delivery.delivery_latitude}
                        longitude={delivery.delivery_longitude}
                        onChange={({ latitude, longitude, address, city, state, postal_code }) => {
                          setDelivery((prev) => ({
                            ...prev,
                            delivery_latitude: latitude,
                            delivery_longitude: longitude,
                            delivery_address: address || prev.delivery_address,
                            delivery_city: city || prev.delivery_city,
                            delivery_state: state || prev.delivery_state,
                            delivery_postal_code: postal_code || prev.delivery_postal_code,
                          }))
                        }}
                        label="Map Pin"
                      />
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Delivery Instructions
                        </label>
                        <textarea
                          value={delivery.delivery_instructions}
                          onChange={handleDeliveryFieldChange( 'delivery_instructions' )}
                          placeholder="Landmark, preferred delivery window, gate instructions"
                          rows={2}
                          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Order notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={( event ) => setNotes( event.target.value )}
                    placeholder="Example: Please deliver as soon as possible"
                    rows={2}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              )}

              {!isPaymentStep ? (
                <>
                  <button
                    type="button"
                    onClick={handleProceedToPay}
                    disabled={isPreparingPayment || !isDeliveryReady}
                    className="mt-6 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-linear-to-r from-blue-600 to-green-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:from-blue-500 hover:to-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreparingPayment
                      ? paymentMethod === 'cash_on_delivery'
                        ? 'Placing cash on delivery orders...'
                        : 'Preparing payment QR codes...'
                      : paymentMethod === 'cash_on_delivery'
                        ? 'Place cash on delivery order'
                        : 'Create orders and pay'}
                  </button>
                  <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
                    {paymentMethod === 'cash_on_delivery'
                      ? 'This will place your order now and let you pay when it is delivered.'
                      : 'This will create your order and show a UPI payment QR code for each seller.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Progress</p>
                    <p className="mt-1 text-3xl font-black text-blue-600 dark:text-blue-400">
                      {completedPayments}/{paymentOrders.length}
                    </p>
                    <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">Payments confirmed</p>
                  </div>
                  <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
                    Pay each seller with the QR code shown here, then enter the UPI transaction ID to confirm it.
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserCheckoutPage
