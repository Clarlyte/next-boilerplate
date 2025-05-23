import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    const { data: equipment, error } = await supabase
      .from('equipment')
      .select(`
        equipment_id,
        name,
        type,
        description,
        status,
        quantity_available,
        image_url,
        notes,
        is_active,
        shop_id,
        created_at,
        updated_at,
        rental_rates (
          rental_rate_id,
          min_days,
          max_days,
          daily_rate
        )
      `)
      .order('name')

    if (error) throw error

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json({ error: 'Failed to fetch equipment' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()
    
    console.log('Received equipment data:', body)
    
    const {
      name,
      type,
      description,
      status = 'Available',
      quantity_available = 1,
      image_url,
      notes,
      is_active = true,
      shop_id,
      rental_rates
    } = body

    // Validate required fields
    if (!name || !type) {
      console.error('Missing required fields:', { name, type })
      return NextResponse.json(
        { error: 'Missing required fields: name and type are required' },
        { status: 400 }
      )
    }

    // Get the default rental price from rental rates if provided
    const rental_price_day = rental_rates && rental_rates.length > 0
      ? Math.min(...rental_rates.map((rate: any) => rate.daily_rate))
      : 0

    // Start a transaction
    const { data: equipment, error: equipmentError } = await supabase
      .from('equipment')
      .insert({
        name,
        type,
        description,
        status,
        quantity_available,
        image_url,
        notes,
        is_active,
        shop_id: shop_id || null,
        rental_price_day
      })
      .select()
      .single()

    if (equipmentError) {
      console.error('Error inserting equipment:', equipmentError)
      throw equipmentError
    }

    console.log('Equipment inserted:', equipment)

    // Insert rental rates if provided
    if (rental_rates && rental_rates.length > 0) {
      console.log('Inserting rental rates:', rental_rates)
      
      const { error: ratesError } = await supabase
        .from('rental_rates')
        .insert(
          rental_rates.map((rate: any) => ({
            equipment_id: equipment.equipment_id,
            min_days: rate.min_days,
            max_days: rate.max_days,
            daily_rate: rate.daily_rate
          }))
        )

      if (ratesError) {
        console.error('Error inserting rental rates:', ratesError)
        throw ratesError
      }
    }

    // Fetch the complete equipment data with rental rates
    const { data: completeEquipment, error: fetchError } = await supabase
      .from('equipment')
      .select(`
        equipment_id,
        name,
        type,
        description,
        status,
        quantity_available,
        image_url,
        notes,
        is_active,
        shop_id,
        rental_price_day,
        created_at,
        updated_at,
        rental_rates (
          rental_rate_id,
          min_days,
          max_days,
          daily_rate
        )
      `)
      .eq('equipment_id', equipment.equipment_id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete equipment:', fetchError)
      throw fetchError
    }

    console.log('Complete equipment data:', completeEquipment)
    return NextResponse.json(completeEquipment)
  } catch (error) {
    console.error('Error creating equipment:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to create equipment'
    }, { status: 500 })
  }
} 