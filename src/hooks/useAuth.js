import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { auth } from "../utils/firebaseConfig";
import { db } from "../utils/firebaseConfig";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubscribeAdmin = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (unsubscribeAdmin) {
        unsubscribeAdmin();
        unsubscribeAdmin = null;
      }

      setUser(currentUser);
      setError(null);

      if (!currentUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      const adminRef = ref(db, `admin_roles/${currentUser.uid}`);
      unsubscribeAdmin = onValue(
        adminRef,
        (snapshot) => {
          setIsAdmin(snapshot.val() === true);
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setIsAdmin(false);
          setLoading(false);
        },
      );
    });

    return () => {
      if (unsubscribeAdmin) {
        unsubscribeAdmin();
      }
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      return result.user;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOut(auth);
      setUser(null);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  return {
    user,
    loading,
    error,
    login,
    logout,
    isAdmin,
  };
};
