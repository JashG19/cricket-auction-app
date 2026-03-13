import { useState, useEffect } from 'react'
import { ref, onValue, off } from 'firebase/database'
import { db } from '../utils/firebaseConfig'

export const useRealtimeData = (path) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!path) {
      setLoading(false)
      return
    }

    const dataRef = ref(db, path)

    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData(snapshot.val())
        } else {
          setData(null)
        }
        setLoading(false)
        setError(null)
      },
      (error) => {
        setError(error.message)
        setLoading(false)
      }
    )

    return () => {
      off(dataRef)
      unsubscribe()
    }
  }, [path])

  return { data, loading, error }
}
